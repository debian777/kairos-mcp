import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import {
    AUTH_RATE_LIMIT_MAX,
    AUTH_RATE_LIMIT_WINDOW_MS,
    HTTP_JSON_BODY_LIMIT,
    HTTP_RATE_LIMIT_MAX,
    HTTP_RATE_LIMIT_WINDOW_MS,
    MCP_RATE_LIMIT_MAX,
    MCP_RATE_LIMIT_WINDOW_MS
} from '../config.js';
import { httpLogger } from '../utils/structured-logger.js';
import { httpMetricsMiddleware } from '../http/http-metrics-middleware.js';

/** Minimal CSP for API server (no HTML UI); satisfies security scanners while avoiding breakage. */
const HELMET_CSP = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'"],
    imgSrc: ["'self'"],
    connectSrc: ["'self'"],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"],
    frameAncestors: ["'self'"]
  }
} as const;

export function createRateLimiter(options: {
    identifier: string;
    windowMs: number;
    limit: number;
    message: string;
}) {
    return rateLimit({
        windowMs: options.windowMs,
        limit: options.limit,
        standardHeaders: 'draft-8',
        // eslint-disable-next-line kairos-forbidden-text/no-forbidden-kairos-text -- express-rate-limit upstream option name
        legacyHeaders: false,
        identifier: options.identifier,
        message: {
            error: 'RATE_LIMITED',
            message: options.message
        }
    });
}

/**
 * Configure Express application with middleware
 * @param app Express application instance
 */
export function configureMiddleware(app: express.Express) {
    // Structured HTTP access logging middleware
    app.use(httpLogger);
    // HTTP metrics middleware for Prometheus
    app.use(httpMetricsMiddleware);
    app.use(helmet({ contentSecurityPolicy: HELMET_CSP }));
    app.use('/auth', createRateLimiter({
        identifier: 'auth',
        windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
        limit: AUTH_RATE_LIMIT_MAX,
        message: 'Too many authentication requests. Try again later.'
    }));
    app.use('/api', createRateLimiter({
        identifier: 'api',
        windowMs: HTTP_RATE_LIMIT_WINDOW_MS,
        limit: HTTP_RATE_LIMIT_MAX,
        message: 'Too many API requests. Try again later.'
    }));
    app.use('/mcp', createRateLimiter({
        identifier: 'mcp',
        windowMs: MCP_RATE_LIMIT_WINDOW_MS,
        limit: MCP_RATE_LIMIT_MAX,
        message: 'Too many MCP requests. Try again later.'
    }));
    app.use(express.json({ limit: HTTP_JSON_BODY_LIMIT }));
}
