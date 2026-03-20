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
import { httpMetricsMiddleware } from './http-metrics-middleware.js';

type HelmetFactory = (options?: { contentSecurityPolicy?: false }) => express.RequestHandler;

function createRateLimiter(options: {
    identifier: string;
    windowMs: number;
    limit: number;
    message: string;
}) {
    return rateLimit({
        windowMs: options.windowMs,
        limit: options.limit,
        standardHeaders: 'draft-8',
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
    const applyHelmet = helmet as unknown as HelmetFactory;
    app.use(applyHelmet({ contentSecurityPolicy: false }));
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