/**
 * Structured HTTP Access Logging for KAIROS MCP
 *
 * Uses shared Pino backend (log-core) for consistent JSON shape.
 * See docs/logging.md for levels, standard fields, and usage.
 *
 * Features:
 * - request_id, client_ip, duration_ms, error_code
 * - child(component, module) for context
 * - Proxy-safe client IP when TRUSTED_PROXY_CIDRS is set
 */

import pino from 'pino';
import type { Request, Response } from 'express';
import { getBaseLogger } from './log-core.js';
import { LOG_LEVEL, LOG_FORMAT, TRANSPORT_TYPE } from '../config.js';

const TRUSTED_PROXY_CIDRS = (process.env['TRUSTED_PROXY_CIDRS'] || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

function getClientIp(req: Request): string {
  const reqWithSocket = req as Request & { socket?: { remoteAddress?: string }; ip?: string };
  const remote = reqWithSocket?.socket?.remoteAddress ?? reqWithSocket?.ip ?? 'unknown';
  const xff = (req.headers && req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']) : '');

  if (!xff) return remote;

  if (TRUSTED_PROXY_CIDRS.length > 0) {
    const first = xff.split(',')[0];
    return (first && first.trim()) || remote;
  }

  return remote;
}

const baseLogger = getBaseLogger();

// HTTP logging middleware
const httpLogger = (req: Request, res: Response, next: Function): void => {
  const start = Date.now();
  const startTime = new Date().toISOString();
  const requestId = (req.headers['x-request-id'] as string) || `req-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  (req as Request & { requestId?: string }).requestId = requestId;

  baseLogger.info({
    time: startTime,
    http: { method: req.method, path: req.url, protocol: `HTTP/${req.httpVersion}` },
    client: { ip: getClientIp(req) },
    user_agent: req.headers['user-agent'],
    request_id: requestId
  }, `${req.method} ${req.url}`);

  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = (res as Response & { statusCode?: number }).statusCode ?? 500;
    const methodName = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    const rid = (req as Request & { requestId?: string }).requestId ?? req.headers['x-request-id'];
    (baseLogger as pino.Logger)[methodName]({
      time: new Date().toISOString(),
      http: { method: req.method, path: req.url, protocol: `HTTP/${req.httpVersion}` },
      status: statusCode,
      response_time_ms: duration,
      client: { ip: getClientIp(req) },
      user_agent: req.headers['user-agent'],
      request_id: rid
    }, `${req.method} ${req.url} -> ${statusCode}`);
  });

  next();
};

export type ToolOperation = 'search' | 'store' | 'update' | 'delete' | 'retrieve' | 'upsert' | 'rate';

export interface ErrorLogOptions {
  error_code?: string;
  request_id?: string;
  [key: string]: unknown;
}

export interface StructuredLoggerApi {
  debug(message: string): void;
  info(message: string): void;
  info(bindings: Record<string, unknown>, message: string): void;
  warn(message: string): void;
  error(message: string, error?: Error | unknown): void;
  error(message: string, error: Error | unknown, options: ErrorLogOptions): void;
  tool(toolName: string, operation: ToolOperation, details: string): void;
  success(operation: string, details: string): void;
  requestTimeout(operation: string, timeoutMs: number): void;
  getTransportType(): 'stdio' | 'http';
  getLogFormat(): 'text' | 'json';
  getPinoLogger(): pino.Logger;
  child(bindings: Record<string, unknown>): StructuredLoggerApi;
}

function wrapPino(pinoInstance: pino.Logger): StructuredLoggerApi {
  const includeStack = LOG_LEVEL === 'debug' || process.env['NODE_ENV'] === 'development';

  return {
    debug(message: string): void {
      pinoInstance.debug(message);
    },

    info(msgOrBindings: string | Record<string, unknown>, message?: string): void {
      if (typeof msgOrBindings === 'string') {
        pinoInstance.info({ category: 'info' }, msgOrBindings);
      } else {
        pinoInstance.info({ ...msgOrBindings, category: 'info' }, (message ?? ''));
      }
    },

    warn(message: string): void {
      pinoInstance.warn({ category: 'warning' }, message);
    },

    error(message: string, error?: Error | unknown, options?: ErrorLogOptions): void {
      const bindings: Record<string, unknown> = { category: 'error' };
      if (options && options['error_code']) bindings['error_code'] = options['error_code'];
      if (options && options['request_id']) bindings['request_id'] = options['request_id'];
      if (options) {
        Object.keys(options).forEach(k => {
          if (k !== 'error_code' && k !== 'request_id') bindings[k] = (options as Record<string, unknown>)[k];
        });
      }
      if (error) {
        bindings['error'] = error instanceof Error
          ? { message: error.message, stack: includeStack ? error.stack : undefined }
          : error;
      }
      pinoInstance.error(bindings, message);
    },

    tool(toolName: string, operation: ToolOperation, details: string): void {
      const msg = `[${toolName}] ${operation.toUpperCase()} ${details}`;
      pinoInstance.info({
        tool: toolName,
        operation: operation.toUpperCase(),
        details,
        category: 'tool_operation'
      }, msg);
    },

    success(operation: string, details: string): void {
      pinoInstance.info(
        { operation, details, category: 'success' },
        `[${operation}] ${details}`
      );
    },

    requestTimeout(operation: string, timeoutMs: number): void {
      pinoInstance.error({
        operation,
        timeoutMs,
        category: 'timeout',
        note: 'Client did not receive response'
      }, 'Request timeout');
    },

    getTransportType(): 'stdio' | 'http' {
      return TRANSPORT_TYPE;
    },

    getLogFormat(): 'text' | 'json' {
      return LOG_FORMAT === 'json' ? 'json' : 'text';
    },

    getPinoLogger(): pino.Logger {
      return pinoInstance;
    },

    child(bindings: Record<string, unknown>): StructuredLoggerApi {
      return wrapPino(pinoInstance.child(bindings));
    }
  };
}

const structuredLogger = wrapPino(baseLogger);

export { structuredLogger, httpLogger, getClientIp };
export type { Request, Response };
export type { Logger } from 'pino';
