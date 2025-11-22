import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { structuredLogger } from './utils/structured-logger.js';
import { LOG_LEVEL } from './config.js';

/**
 * Track request start times by ID for accurate cancellation timing
 */
const requestTimestamps = new Map<string, number>();

/**
 * Set up MCP endpoint handling
 * @param app Express application instance
 * @param server MCP server instance
 */
export function setupMcpRoutes(app: express.Express, server: any) {
    // MCP endpoint using StreamableHTTPServerTransport
    app.post('/mcp', async (req, res) => {
        const requestStart = Date.now();
        const requestId = req.body?.id || 'unknown';
        const method = req.body?.method || 'unknown';
        const toolName = req.body?.params?.name || 'unknown';

        // Store timestamp for non-notification requests
        if (method !== 'notifications/cancelled' && requestId !== 'unknown') {
            requestTimestamps.set(requestId, requestStart);
        }

        // Log incoming request with level control
        const logLevel = LOG_LEVEL;
        if (logLevel === 'debug' || method !== 'notifications/cancelled') {
            structuredLogger.info(`→ MCP ${method}${toolName !== 'unknown' ? ` (${toolName})` : ''} [id: ${requestId}]`);
        }

        try {
            // Create new transport for each request to prevent request ID collisions
            const transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: undefined,
                enableJsonResponse: true
            });

            // Track request timeout - log at 25s (before typical 30s client timeout)
            let requestCompleted = false;
            const timeoutHandler = setTimeout(() => {
                if (!requestCompleted) {
                    const duration = Date.now() - requestStart;
                    structuredLogger.requestTimeout(`${method} ${toolName ? `(${toolName})` : ''} [id: ${requestId}]`, duration);
                }
            }, 25000); // Log at 25s (before typical 30s client timeout)

            res.on('close', () => {
                requestCompleted = true;
                clearTimeout(timeoutHandler);
                const duration = Date.now() - requestStart;

                if (method === 'notifications/cancelled') {
                    // For cancellation notifications, find the original request's start time
                    const originalStart = requestTimestamps.get(requestId);
                    const actualDuration = originalStart ? Date.now() - originalStart : duration;
                    structuredLogger.warn(`⚡ Client cancelled request after ${actualDuration}ms [id: ${requestId}] - operation may continue in background`);

                    // Clean up timestamp
                    if (requestId !== 'unknown') {
                        requestTimestamps.delete(requestId);
                    }
                } else if (duration > 20000) {
                    structuredLogger.warn(`← Request closed after ${duration}ms: ${method}${toolName !== 'unknown' ? ` (${toolName})` : ''} [id: ${requestId}]`);

                    // Clean up timestamp
                    if (requestId !== 'unknown') {
                        requestTimestamps.delete(requestId);
                    }
                } else if (logLevel === 'debug') {
                    structuredLogger.info(`← Request closed ${duration}ms [id: ${requestId}]`);
                }

                transport.close();
            });

            res.on('finish', () => {
                requestCompleted = true;
                clearTimeout(timeoutHandler);
                const duration = Date.now() - requestStart;

                if (duration > 10000 && method !== 'notifications/cancelled') {
                    structuredLogger.info(`✓ Request completed in ${duration}ms: ${method}${toolName !== 'unknown' ? ` (${toolName})` : ''} [id: ${requestId}]`);
                } else if (logLevel === 'debug') {
                    structuredLogger.info(`✓ Completed ${duration}ms [id: ${requestId}]`);
                }
            });

            // Connect server with request context for tool handlers
            await server.connect(transport);
            // Set up request context for model identity detection
            (transport as any)._requestContext = req;

            // Set up global context for tools to access
            globalThis._mcpRequestContext = req;
            globalThis._mcpTransport = transport;

            await transport.handleRequest(req, res, req.body);

            // Clean up context after request
            delete globalThis._mcpRequestContext;
            delete globalThis._mcpTransport;

            requestCompleted = true;
            clearTimeout(timeoutHandler);
        } catch (error) {
            const duration = Date.now() - requestStart;
            structuredLogger.error(`✗ MCP error: ${method}${toolName !== 'unknown' ? ` (${toolName})` : ''} [id: ${requestId}] after ${duration}ms`, error);
            if (!res.headersSent) {
                res.status(500).json({
                    jsonrpc: '2.0',
                    error: {
                        code: -32603,
                        message: 'Internal server error'
                    },
                    id: requestId === 'unknown' ? null : requestId
                });
            }
        }
    });
}