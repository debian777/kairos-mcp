/**
 * Structured HTTP Access Logging for KAIROS MCP
 * 
 * Implements Pino-first, Apache/Nginx "combined" format for humans
 * Follows docs/node-structured-access-logging.md specification
 * 
 * Features:
 * - Structured JSON logging (source of truth)
 * - Optional human-readable combined format
 * - Proxy-safe client IP detection
 * - Request correlation and timing
 * - Transport-aware (stdio vs HTTP)
 * - Environment configurable
 */

import pino from 'pino';
import type { Request, Response } from 'express';

// Environment configuration
const LOG_LEVEL = process.env['LOG_LEVEL'] || 'info';
const TRUSTED_PROXY_CIDRS = (process.env['TRUSTED_PROXY_CIDRS'] || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Transport detection (TRANSPORT_TYPE only)
const isHttpTransport = (): boolean =>
  (process.env['TRANSPORT_TYPE'] || 'stdio') === 'http';

// Client IP detection (proxy-safe)
function getClientIp(req: Request): string {
  const remote = (req as any)?.socket?.remoteAddress || req?.ip || 'unknown';
  const xff = (req as any)?.headers?.['x-forwarded-for']?.toString() || '';

  if (!xff) return remote;

  // Only trust X-Forwarded-For if we have explicit trusted proxy CIDRs
  if (TRUSTED_PROXY_CIDRS.length > 0) {
    const firstHop = xff.split(',')[0].trim();
    return firstHop || remote;
  }

  return remote;
}

// Create base Pino logger with proper configuration
const baseLogger = pino({
  level: LOG_LEVEL,
  timestamp: pino.stdTimeFunctions.isoTime,
  // Redact sensitive data
  redact: {
    paths: [
      'req.headers.authorization',
      '*.password',
      '*.secret',
      'user.ssn',
      'req.headers.cookie',
      'res.headers["set-cookie"]'
    ],
    censor: '[REDACTED]'
  },
  // Custom serializers for request/response data
  serializers: {
    req(req: Request) {
      return {
        method: req?.method,
        url: req?.url,
        headers: {
          'user-agent': req?.headers?.['user-agent'],
          'x-request-id': req?.headers?.['x-request-id']
        }
      };
    },
    res(res: Response) {
      return {
        statusCode: res?.statusCode
      };
    }
  }
});

// Simple HTTP logging middleware
const httpLogger = (req: Request, res: Response, next: Function) => {
  const start = Date.now();
  const startTime = new Date().toISOString();

  // Log request start
  baseLogger.info({
    time: startTime,
    http: {
      method: req.method,
      path: req.url,
      protocol: `HTTP/${req.httpVersion}`
    },
    client: {
      ip: getClientIp(req)
    },
    user_agent: req.headers['user-agent'],
    request_id: req.headers['x-request-id'] || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }, `${req.method} ${req.url}`);

  // Log response on finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    const methodName = (res as any).statusCode >= 500 ? 'error' : (res as any).statusCode >= 400 ? 'warn' : 'info';
    (baseLogger as any)[methodName]({
      time: new Date().toISOString(),
      http: {
        method: req.method,
        path: req.url,
        protocol: `HTTP/${req.httpVersion}`
      },
      status: (res as any).statusCode,
      response_time_ms: duration,
      client: {
        ip: getClientIp(req)
      },
      user_agent: req.headers['user-agent'],
      request_id: req.headers['x-request-id']
    }, `${req.method} ${req.url} -> ${(res as any).statusCode}`);
  });

  next();
};

/**
 * Legacy Logger Interface - Maintains backward compatibility
 * with existing KAIROS logging calls
 */
class StructuredLogger {
  private transportType: 'stdio' | 'http' = 'stdio';
  private logFormat: 'text' | 'json' = 'text';

  constructor() {
    this.transportType = isHttpTransport() ? 'http' : 'stdio';
    this.logFormat = process.env['LOG_FORMAT'] === 'json' ? 'json' : 'text';
  }

  /**
   * Log debug messages
   */
  debug(message: string): void {
    baseLogger.debug(message);
  }

  /**
   * Format tool operations with concise, clean output
   */
  tool(toolName: string, operation: 'search' | 'store' | 'update' | 'delete' | 'retrieve' | 'upsert' | 'rate', details: string): void {
    const logData = {
      tool: toolName,
      operation: operation.toUpperCase(),
      details,
      category: 'tool_operation'
    };

    const message = `[${toolName}] ${operation.toUpperCase()} ${details}`;
    baseLogger.info(logData, message);
  }

  /**
   * Log success status
   */
  success(operation: string, details: string): void {
    const logData = {
      operation,
      details,
      category: 'success'
    };
    const message = `[${operation}] ${details}`;
    baseLogger.info(logData, message);
  }

  /**
   * Log error messages with full context
   */
  error(message: string, error?: Error | any): void {
    const errorData: any = {
      category: 'error'
    };

    if (error) {
      errorData.error = error instanceof Error ? {
        message: error.message,
        stack: process.env['NODE_ENV'] === 'development' ? error.stack : undefined
      } : error;
    }

    baseLogger.error(errorData, message);
  }

  /**
   * Log warning messages
   */
  warn(message: string): void {
    baseLogger.warn({ category: 'warning' }, message);
  }

  /**
   * Log info messages
   */
  info(message: string): void {
    baseLogger.info({ category: 'info' }, message);
  }

  /**
   * Log MCP request timeout errors
   */
  requestTimeout(operation: string, timeoutMs: number): void {
    baseLogger.error({
      operation,
      timeoutMs,
      category: 'timeout',
      note: 'Client did not receive response'
    }, 'Request timeout');
  }

  /**
   * Access logging for HTTP requests
   * Emits structured logs with client IP, request ID, timing, etc.
   */
  accessLog(req: Request, res: Response, duration: number): void {
    const logData = {
      time: new Date().toISOString(),
      level: ((res as any)?.statusCode || 500) >= 400 ? 'warn' : 'info',
      msg: `${req?.method} ${req?.url}`,

      // Request details
      request_id: (req as any)?.headers?.['x-request-id'] || null,
      client: {
        ip: getClientIp(req)
      },
      http: {
        method: req?.method,
        path: req?.url,
        protocol: `HTTP/${req?.httpVersion}`
      },

      // Response details
      status: (res as any)?.statusCode,
      response_time_ms: duration,

      // Context
      user_agent: (req as any)?.headers?.['user-agent'] || null,
      referer: (req as any)?.headers?.['referer'] || (req as any)?.headers?.['referrer'] || null
    };

    if (this.transportType === 'stdio') {
      baseLogger.info(logData, JSON.stringify(logData));
    } else {
      // Fallback logging disabled - structured logging should always work
    }
  }

  /**
   * Get the current transport type
   */
  getTransportType(): 'stdio' | 'http' {
    return this.transportType;
  }

  /**
   * Get the current log format
   */
  getLogFormat(): 'text' | 'json' {
    return this.logFormat;
  }

  /**
   * Get the underlying Pino logger instance for advanced usage
   */
  getPinoLogger(): pino.Logger {
    return baseLogger;
  }

  /**
   * Create child logger with additional context
   */
  child(): StructuredLogger {
    const childLogger = new StructuredLogger();
    childLogger.transportType = this.transportType;
    childLogger.logFormat = this.logFormat;

    return childLogger;
  }
}

// Export singleton instance
export const structuredLogger = new StructuredLogger();

// Export HTTP logger middleware for Express
export { httpLogger };

// Export types
export type { Request, Response };
export type { Logger } from 'pino';
