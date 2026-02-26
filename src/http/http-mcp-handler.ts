import crypto from 'node:crypto';
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { structuredLogger } from '../utils/structured-logger.js';
import { LOG_LEVEL, AUTH_ENABLED } from '../config.js';
import { setWwwAuthenticate } from './http-auth-middleware.js';

interface McpSession {
    transport: StreamableHTTPServerTransport;
    server: McpServer;
    createdAt: number;
}

const sessions = new Map<string, McpSession>();

const requestTimestamps = new Map<string, number>();

export type McpServerFactory = () => McpServer;

/**
 * Set up MCP endpoint handling using stateful sessions.
 *
 * Each MCP client session gets its own McpServer + Transport pair.
 * The SDK enforces one-transport-per-server; stateful sessions let
 * multiple clients coexist without "already connected" errors.
 */
export function setupMcpRoutes(app: express.Express, serverFactory: McpServerFactory) {
    app.post('/mcp', async (req, res) => {
        const requestStart = Date.now();
        const requestId = req.body?.id || 'unknown';
        const method = req.body?.method || 'unknown';
        const toolName = req.body?.params?.name || 'unknown';

        if (method !== 'notifications/cancelled' && requestId !== 'unknown') {
            requestTimestamps.set(requestId, requestStart);
        }

        const logLevel = LOG_LEVEL;
        if (logLevel === 'debug' || method !== 'notifications/cancelled') {
            structuredLogger.info(`→ MCP ${method}${toolName !== 'unknown' ? ` (${toolName})` : ''} [id: ${requestId}]`);
        }

        if (method === 'listOfferingsForUI') {
            const id = req.body?.id ?? null;
            if (AUTH_ENABLED && !req.auth) {
                setWwwAuthenticate(res, {
                    error: 'invalid_token',
                    error_description: 'Authentication required for UI offerings'
                });
                res.status(401).json({
                    jsonrpc: '2.0',
                    error: { code: -32001, message: 'Authentication required for UI offerings' },
                    id
                });
                return;
            }
            res.status(200).json({
                jsonrpc: '2.0',
                result: { tools: [], prompts: [], resources: [] },
                id
            });
            return;
        }

        try {
            const sessionId = req.headers['mcp-session-id'] as string | undefined;
            const isInitialize = method === 'initialize';

            let session: McpSession;

            if (isInitialize) {
                session = await createSession(serverFactory);
                structuredLogger.info(`MCP session created: ${session.transport.sessionId}`);
            } else if (sessionId && sessions.has(sessionId)) {
                session = sessions.get(sessionId)!;
            } else {
                if (!res.headersSent) {
                    const code = sessionId ? 404 : 400;
                    const msg = sessionId ? 'Session not found' : 'Bad Request: Mcp-Session-Id header is required';
                    res.status(code).json({
                        jsonrpc: '2.0',
                        error: { code: -32000, message: msg },
                        id: requestId === 'unknown' ? null : requestId
                    });
                }
                return;
            }

            const { transport } = session;

            let requestCompleted = false;
            const timeoutHandler = setTimeout(() => {
                if (!requestCompleted) {
                    structuredLogger.requestTimeout(
                        `${method} ${toolName !== 'unknown' ? `(${toolName})` : ''} [id: ${requestId}]`,
                        Date.now() - requestStart
                    );
                }
            }, 25000);

            res.on('close', () => {
                requestCompleted = true;
                clearTimeout(timeoutHandler);
                const duration = Date.now() - requestStart;

                if (method === 'notifications/cancelled') {
                    const originalStart = requestTimestamps.get(requestId);
                    const actualDuration = originalStart ? Date.now() - originalStart : duration;
                    structuredLogger.warn(`⚡ Client cancelled request after ${actualDuration}ms [id: ${requestId}] - operation may continue in background`);
                    if (requestId !== 'unknown') requestTimestamps.delete(requestId);
                } else if (duration > 20000) {
                    structuredLogger.warn(`← Request closed after ${duration}ms: ${method}${toolName !== 'unknown' ? ` (${toolName})` : ''} [id: ${requestId}]`);
                    if (requestId !== 'unknown') requestTimestamps.delete(requestId);
                } else if (logLevel === 'debug') {
                    structuredLogger.info(`← Request closed ${duration}ms [id: ${requestId}]`);
                }
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

            await transport.handleRequest(
              req as unknown as Parameters<typeof transport.handleRequest>[0],
              res,
              req.body
            );

            requestCompleted = true;
            clearTimeout(timeoutHandler);
        } catch (error) {
            const duration = Date.now() - requestStart;
            structuredLogger.error(`✗ MCP error: ${method}${toolName !== 'unknown' ? ` (${toolName})` : ''} [id: ${requestId}] after ${duration}ms`, error);
            if (!res.headersSent) {
                res.status(500).json({
                    jsonrpc: '2.0',
                    error: { code: -32603, message: 'Internal server error' },
                    id: requestId === 'unknown' ? null : requestId
                });
            }
        }
    });

    app.get('/mcp', async (req, res) => {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        if (!sessionId || !sessions.has(sessionId)) {
            res.status(400).json({
                jsonrpc: '2.0',
                error: { code: -32000, message: 'Bad Request: valid Mcp-Session-Id header is required for GET SSE' },
                id: null
            });
            return;
        }
        const { transport } = sessions.get(sessionId)!;
        await transport.handleRequest(
            req as unknown as Parameters<typeof transport.handleRequest>[0],
            res
        );
    });

    app.delete('/mcp', async (req, res) => {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        if (!sessionId || !sessions.has(sessionId)) {
            res.status(404).json({
                jsonrpc: '2.0',
                error: { code: -32001, message: 'Session not found' },
                id: null
            });
            return;
        }
        const session = sessions.get(sessionId)!;
        await session.transport.close();
        await session.server.close();
        sessions.delete(sessionId);
        structuredLogger.info(`MCP session closed: ${sessionId}`);
        res.status(200).end();
    });
}

async function createSession(serverFactory: McpServerFactory): Promise<McpSession> {
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        enableJsonResponse: true,
        onsessioninitialized: (sessionId: string) => {
            sessions.set(sessionId, session);
            structuredLogger.info(`MCP session registered: ${sessionId} (active: ${sessions.size})`);
        }
    });

    transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && sessions.has(sid)) {
            sessions.delete(sid);
            structuredLogger.info(`MCP session removed: ${sid} (active: ${sessions.size})`);
        }
    };

    const server = serverFactory();

    // Connect server ↔ transport (one-to-one, never reconnected)
    // `as any`: SDK typing gap — StreamableHTTPServerTransport has optional callbacks
    // but Protocol.connect() requires them under exactOptionalPropertyTypes
    await server.connect(transport as any);

    const session: McpSession = {
        transport,
        server,
        createdAt: Date.now()
    };

    return session;
}
