import express from 'express';
import { httpLogger } from './utils/structured-logger.js';

// Global context interface for MCP requests
declare global {
    var _mcpRequestContext: any;
    var _mcpTransport: any;
}

/**
 * Configure Express application with middleware
 * @param app Express application instance
 */
export function configureMiddleware(app: express.Express) {
    // Structured HTTP access logging middleware
    app.use(httpLogger);
    app.use(express.json());
}