/**
 * MCP audit event emission.
 *
 * Isolated from http-mcp-handler.ts to keep that file under the max-lines lint
 * limit. Called from the MCP HTTP handler after tool execution completes.
 */

import { randomUUID } from 'node:crypto';
import type express from 'express';
import { writeAuditLine } from '../utils/structured-logger.js';
import { AUDIT_LOG_LEVEL } from '../config.js';
import { getBuildVersion } from '../utils/build-version.js';
import { summarizeRequestArgs, summarizeResponse, extractErrorCode } from '../utils/audit-mcp-summary.js';

export { AUDIT_LOG_LEVEL };

/**
 * Capture JSON-RPC response for audit level 3.
 *
 * The MCP SDK's StreamableHTTPServerTransport writes responses via res.end()
 * (through @hono/node-server), NOT res.json(). We intercept at the stream level.
 */
export function installResponseCapture(res: express.Response): { getResponse: () => unknown } {
  let captured: unknown = null;
  const chunks: Buffer[] = [];
  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);

  res.write = function (chunk: unknown, ...args: unknown[]): boolean {
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    return (originalWrite as Function)(chunk, ...args);
  };

  res.end = function (chunk?: unknown, ...args: unknown[]): express.Response {
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    if (chunks.length > 0) {
      try { captured = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { /* non-JSON */ }
    }
    return (originalEnd as Function)(chunk, ...args);
  };

  return { getResponse: () => captured };
}

/** Generate a correlation ID for grouping related MCP requests. */
export function generateCorrelationId(): string {
  return `corr-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

/** Emit mcp_request_start audit event (before space context, tenant_id unknown). */
export function emitRequestStart(correlationId: string, requestId: string, method: string, toolName: string): void {
  if (AUDIT_LOG_LEVEL <= 0) return;
  writeAuditLine('info', {
    category: 'audit.mcp',
    event: 'mcp_request_start',
    correlation_id: correlationId,
    tenant_id: 'unknown',
    request_id: requestId,
    mcp_method: method,
    tool_name: toolName,
    server_version: getBuildVersion()
  });
}

/** Emit mcp_request_end audit event (in response finish handler). */
export function emitRequestEnd(correlationId: string, requestId: string, toolName: string, durationMs: number): void {
  if (AUDIT_LOG_LEVEL <= 0) return;
  writeAuditLine('info', {
    category: 'audit.mcp',
    event: 'mcp_request_end',
    correlation_id: correlationId,
    tenant_id: 'unknown',
    request_id: requestId,
    tool_name: toolName,
    duration_ms: durationMs
  });
}

/**
 * Emit mcp_tool_call audit event.
 * Called from the response finish handler with pre-captured tenantId.
 */
export function emitToolCallAudit(
  correlationId: string,
  requestId: string,
  toolName: string,
  requestStart: number,
  capturedResponse: unknown,
  requestArgs: unknown,
  tenantId: string
): void {
  if (AUDIT_LOG_LEVEL <= 0) return;

  const durationMs = Date.now() - requestStart;
  const isError = capturedResponse !== null &&
    typeof capturedResponse === 'object' &&
    'error' in (capturedResponse as Record<string, unknown>);

  const auditBindings: Record<string, unknown> = {
    category: 'audit.mcp',
    event: 'mcp_tool_call',
    stage: 'response',
    correlation_id: correlationId,
    tenant_id: tenantId,
    request_id: requestId,
    tool_name: toolName,
    status: isError ? 'error' : 'success',
    duration_ms: durationMs,
    error_code: isError ? extractErrorCode(capturedResponse) : undefined
  };

  if (AUDIT_LOG_LEVEL >= 2) {
    auditBindings['request'] = summarizeRequestArgs(toolName, requestArgs);
  }
  if (AUDIT_LOG_LEVEL >= 3 && capturedResponse) {
    const rpcResult = capturedResponse as Record<string, unknown>;
    auditBindings['response'] = summarizeResponse(toolName, rpcResult['result'] ?? rpcResult['error']);
  }

  writeAuditLine('info', auditBindings);
}
