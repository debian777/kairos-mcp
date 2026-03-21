import express, { type ErrorRequestHandler } from 'express';
import { structuredLogger } from '../utils/structured-logger.js';

const globalErrorHandler: ErrorRequestHandler = (err, req, res, _next) => {
    try {
        const rid = req?.headers?.['x-request-id'] || 'unknown';
        const method = req?.method || 'UNKNOWN';
        const url = req?.url || 'UNKNOWN';
        structuredLogger.error('HTTP error handled by global Express handler', err, {
            request_id: rid,
            http_method: method,
            http_url: url
        });
    } catch { }

    if (!res.headersSent) {
        if (err?.status === 413 || err?.statusCode === 413 || err?.type === 'entity.too.large') {
            res.status(413).json({
                error: 'PAYLOAD_TOO_LARGE',
                message: 'Request body exceeds the configured size limit'
            });
            return;
        }
        res.status(500).json({ error: 'Internal server error' });
    } else {
        res.end();
    }
};

/**
 * Set up error handlers and additional routes
 * @param app Express application instance
 */
export function setupErrorHandlers(app: express.Express) {
    app.use(globalErrorHandler);

    // MCP endpoint - reject GET requests (must be POST)
    app.get('/mcp', (req, res) => {
        res.status(405).set('Allow', 'POST').json({
            error: 'Method Not Allowed - use POST /mcp'
        });
    });

    // Catch-all 404 handler (must be last)
    app.use((req, res) => {
        res.status(404).json({ error: 'Not found' });
    });
}