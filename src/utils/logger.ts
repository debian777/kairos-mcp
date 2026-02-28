/**
 * Logging utility for KAIROS MCP.
 * Uses shared Pino backend (log-core) so JSON shape matches structured-logger.
 *
 * - STDIO: Logs to stderr (stdout reserved for MCP protocol)
 * - HTTP: Logs to stdout
 * - LOG_FORMAT=text | json controlled in log-core
 */

import { getBaseLogger } from './log-core.js';
import { LOG_FORMAT, TRANSPORT_TYPE } from '../config.js';

type ToolOperation = 'search' | 'store' | 'update' | 'delete' | 'retrieve' | 'upsert' | 'rate';

const base = getBaseLogger();

const logger = {
  debug(message: string): void {
    base.debug(message);
  },

  info(message: string): void {
    base.info({}, message);
  },

  warn(message: string): void {
    base.warn({}, message);
  },

  error(message: string, error?: Error | unknown): void {
    const bindings: Record<string, unknown> = {};
    if (error) {
      bindings['error'] = error instanceof Error
        ? {
            message: error.message,
            stack: process.env['LOG_LEVEL'] === 'debug' || process.env['NODE_ENV'] === 'development'
              ? error.stack
              : undefined
          }
        : error;
    }
    base.error(bindings, message);
  },

  tool(
    toolName: string,
    operation: ToolOperation,
    details: string
  ): void {
    base.info(
      {
        tool: toolName,
        operation: operation.toUpperCase(),
        details,
        category: 'tool_operation'
      },
      `[${toolName}] ${operation.toUpperCase()} ${details}`
    );
  },

  success(operation: string, details: string): void {
    base.info(
      { operation, details, category: 'success' },
      `[${operation}] ${details}`
    );
  },

  requestTimeout(operation: string, timeoutMs: number): void {
    base.error(
      {
        operation,
        timeoutMs,
        category: 'timeout',
        note: 'Client did not receive response'
      },
      'Request timeout'
    );
  },

  getTransportType(): 'stdio' | 'http' {
    return TRANSPORT_TYPE;
  },

  getLogFormat(): 'text' | 'json' {
    return LOG_FORMAT === 'json' ? 'json' : 'text';
  }
};

export { logger };
