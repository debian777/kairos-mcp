import { AsyncLocalStorage } from 'node:async_hooks';
import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { structuredLogger } from '../utils/structured-logger.js';
import { LOG_LEVEL, AUTH_ENABLED, MAX_CONCURRENT_MCP_REQUESTS_RAW } from '../config.js';
import { resolveMaxConcurrentRequests } from '../utils/concurrency-limit.js';
import { setWwwAuthenticate } from './http-auth-middleware.js';
import { getSpaceContext, runWithSpaceContextAsync } from '../utils/tenant-context.js';
import { createServer } from '../server.js';
import type { MemoryQdrantStore } from '../services/memory/store.js';
import { KairosError } from '../types/index.js';

const MAX_CONCURRENT = resolveMaxConcurrentRequests(MAX_CONCURRENT_MCP_REQUESTS_RAW);

export interface McpRequestContext {
  req: express.Request;
  transport: StreamableHTTPServerTransport;
}

export const mcpRequestStore = new AsyncLocalStorage<McpRequestContext>();

/**
 * Track request start times by ID for accurate cancellation timing.
 * Entries are deleted on response close/finish; sweep removes any stale entries.
 */
const requestTimestamps = new Map<string, number>();
const STALE_TIMESTAMP_MS = 120_000;
setInterval(() => {
  const now = Date.now();
  for (const [id, start] of requestTimestamps.entries()) {
    if (now - start > STALE_TIMESTAMP_MS) requestTimestamps.delete(id);
  }
}, 60_000);

/** Current number of in-flight MCP requests; used for backpressure (503 when over limit). */
let concurrentMcpRequests = 0;

function sanitizeMcpErrorDetails(details: unknown): Record<string, unknown> {
  if (!details || typeof details !== 'object') {
    return {};
  }

  try {
    return JSON.parse(JSON.stringify(details)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Help text and error_code for clients; never expose internal error details. */
function mcpErrorToHelp(
  error: unknown
): { message: string; error_code: string; retry_hint: string; details?: Record<string, unknown> } {
  if (error instanceof KairosError) {
    const details = sanitizeMcpErrorDetails(error.details);
    const nextAction = typeof details['next_action'] === 'string' ? details['next_action'] : undefined;
    return {
      message: error.message,
      error_code: typeof error.code === 'string' && error.code.length > 0
        ? error.code
        : 'SERVER_ERROR',
      retry_hint: nextAction ?? 'Adjust the request and retry.',
      ...(Object.keys(details).length > 0 ? { details } : {})
    };
  }

  const msg = error instanceof Error ? error.message : String(error);
  // Defensive: should not trigger with per-request servers; kept as safety net.
  if (msg.includes('Already connected to a transport')) {
    return {
      message: 'Server is busy with another request. Wait a few seconds and retry; if it continues, start a new MCP session.',
      error_code: 'CONNECTION_CONFLICT',
      retry_hint: 'Wait a few seconds and retry the same request; if repeated, start a new MCP session.'
    };
  }
  return {
    message: 'An unexpected error occurred. Please retry. If the problem continues, start a new MCP session.',
    error_code: 'SERVER_ERROR',
    retry_hint: 'Retry the request; if it persists, start a new MCP session.'
  };
}

/**
 * Set up MCP endpoint handling.
 * Uses a new MCP server instance per request so many requests can be handled
 * concurrently on each node (no single-transport limit).
 *
 * @param app Express application instance
 * @param memoryStore Store used to create per-request MCP servers
 */
export function setupMcpRoutes(app: express.Express, memoryStore: MemoryQdrantStore) {
    // MCP endpoint using StreamableHTTPServerTransport
    app.post('/mcp', async (req, res) => {
        const requestStart = Date.now();
        const requestId = req.body?.id || 'unknown';
        const method = req.body?.method || 'unknown';
        const toolName = req.body?.params?.name || 'unknown';

        // Store timestamp for requests that go through the full handler (close/finish will delete)
        if (
            method !== 'notifications/cancelled' &&
            method !== 'listOfferingsForUI' &&
            requestId !== 'unknown'
        ) {
            requestTimestamps.set(requestId, requestStart);
        }

        // Log incoming request with level control
        const logLevel = LOG_LEVEL;
        if (logLevel === 'debug' || method !== 'notifications/cancelled') {
            structuredLogger.info(
                { event: 'mcp_request', mcp_method: method, mcp_tool_name: toolName, request_id: requestId },
                'Incoming MCP request'
            );
        }

        // listOfferingsForUI (MCP Apps / UI discovery): not implemented by SDK. Handle here so the client
        // gets a proper auth-related response when auth is required, instead of -32601 Method not found.
        if (method === 'listOfferingsForUI') {
            const id = req.body?.id ?? null;
            if (AUTH_ENABLED && !req.auth) {
                setWwwAuthenticate(res, {
                    error: 'invalid_token',
                    error_description: 'Authentication required for UI offerings'
                });
                res.status(401).json({
                    jsonrpc: '2.0',
                    error: {
                        code: -32001,
                        message: 'Authentication required for UI offerings'
                    },
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

        concurrentMcpRequests++;
        if (concurrentMcpRequests > MAX_CONCURRENT) {
            concurrentMcpRequests--;
            structuredLogger.warn(
                {
                    event: 'mcp_request_rejected_concurrent_limit',
                    current_concurrent: concurrentMcpRequests + 1,
                    max_concurrent: MAX_CONCURRENT,
                    request_id: requestId
                },
                'MCP request rejected: concurrent limit exceeded'
            );
            if (!res.headersSent) {
                res.status(503).set('Retry-After', '5').json({
                    jsonrpc: '2.0',
                    error: {
                        code: -32603,
                        message: 'Server busy. Retry after a few seconds.',
                        data: { error_code: 'OVERLOADED', retry_hint: 'Retry after Retry-After seconds.' }
                    },
                    id: requestId === 'unknown' ? null : requestId
                });
            }
            return;
        }

        try {
            const server = createServer(memoryStore);
            const transport = new StreamableHTTPServerTransport({
                enableJsonResponse: true
            });

            // Track request timeout - log at 25s (before typical 30s client timeout)
            let requestCompleted = false;
            const timeoutHandler = setTimeout(() => {
                if (!requestCompleted) {
                    const duration = Date.now() - requestStart;
                    structuredLogger.warn(
                        {
                            event: 'mcp_request_timeout',
                            mcp_method: method,
                            mcp_tool_name: toolName,
                            request_id: requestId,
                            duration_ms: duration
                        },
                        'MCP request timeout'
                    );
                }
            }, 25000); // Log at 25s (before typical 30s client timeout)

            const deleteTimestamp = (): void => {
                if (requestId !== 'unknown') requestTimestamps.delete(requestId);
            };

            res.on('close', () => {
                requestCompleted = true;
                clearTimeout(timeoutHandler);
                const duration = Date.now() - requestStart;
                if (method === 'notifications/cancelled') {
                    const originalStart = requestTimestamps.get(requestId);
                    const actualDuration = originalStart ? Date.now() - originalStart : duration;
                    structuredLogger.warn(
                        { event: 'mcp_client_cancelled', duration_ms: actualDuration, request_id: requestId },
                        'Client cancelled request - operation may continue in background'
                    );
                } else if (duration > 20000) {
                    structuredLogger.warn(
                        {
                            event: 'mcp_request_closed',
                            duration_ms: duration,
                            mcp_method: method,
                            mcp_tool_name: toolName,
                            request_id: requestId
                        },
                        'Request closed after threshold'
                    );
                } else if (logLevel === 'debug') {
                    structuredLogger.info(
                        { event: 'mcp_request_closed', duration_ms: duration, request_id: requestId },
                        'Request closed'
                    );
                }
                deleteTimestamp();
                transport.close();
            });

            res.on('finish', () => {
                requestCompleted = true;
                clearTimeout(timeoutHandler);
                deleteTimestamp();
                const duration = Date.now() - requestStart;

                if (duration > 10000 && method !== 'notifications/cancelled') {
                    structuredLogger.info(
                        {
                            event: 'mcp_request_completed',
                            duration_ms: duration,
                            mcp_method: method,
                            mcp_tool_name: toolName,
                            request_id: requestId
                        },
                        'Request completed'
                    );
                } else if (logLevel === 'debug') {
                    structuredLogger.info(
                        { event: 'mcp_request_completed', duration_ms: duration, request_id: requestId },
                        'Completed'
                    );
                }
            });

            await server.connect(transport as Parameters<typeof server.connect>[0]);
            (transport as any)._requestContext = req;

            const requestIdFromHttp = (req as express.Request & { requestId?: string }).requestId;
            const spaceCtx = {
              ...(req.spaceContext ?? getSpaceContext(req)),
              requestId: requestIdFromHttp || requestId || ''
            };
            await runWithSpaceContextAsync(spaceCtx, async () => {
              await mcpRequestStore.run({ req, transport }, async () => {
                await transport.handleRequest(
                  req as unknown as Parameters<typeof transport.handleRequest>[0],
                  res,
                  req.body
                );
              });
            });

            requestCompleted = true;
            clearTimeout(timeoutHandler);
        } catch (error) {
            const duration = Date.now() - requestStart;
            const errName = error instanceof Error ? error.constructor?.name ?? 'Error' : typeof error;
            const errStack = error instanceof Error ? error.stack : undefined;
            structuredLogger.error(
              'MCP request failed',
              error,
              {
                request_id: requestId,
                mcp_method: method,
                mcp_tool_name: toolName,
                duration_ms: duration,
                stack: errStack,
                error_name: errName
              }
            );
            if (!res.headersSent) {
                const help = mcpErrorToHelp(error);
                res.status(500).json({
                    jsonrpc: '2.0',
                    error: {
                        code: -32603,
                        message: help.message,
                        data: {
                          error_code: help.error_code,
                          retry_hint: help.retry_hint,
                          ...(help.details ?? {})
                        }
                    },
                    id: requestId === 'unknown' ? null : requestId
                });
            }
        } finally {
            concurrentMcpRequests--;
        }
    });
}