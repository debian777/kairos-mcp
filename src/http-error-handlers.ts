import express from 'express';
import { structuredLogger } from './utils/structured-logger.js';

/**
 * Set up error handlers and additional routes
 * @param app Express application instance
 */
export function setupErrorHandlers(app: express.Express) {
    // Global error handler for Express routes
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    app.use((err: any, req: any, res: any, next: any) => {
        try {
            const rid = req?.headers?.['x-request-id'] || 'unknown';
            const method = req?.method || 'UNKNOWN';
            const url = req?.url || 'UNKNOWN';
            structuredLogger.error(`HTTP error on ${method} ${url} [id: ${rid}]`, err);
        } catch { }

        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal server error' });
        } else {
            res.end();
        }
    });

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