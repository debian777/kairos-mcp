import express from 'express';
import { MemoryQdrantStore } from '../services/memory/store.js';
import { structuredLogger } from '../utils/structured-logger.js';
import { PORT } from '../config.js';

// Import modular components
import { configureMiddleware } from './http-server-config.js';
import { authMiddleware } from './http-auth-middleware.js';
import { setupAuthCallback } from './http-auth-callback.js';
import { setupHealthRoutes } from './http-health-routes.js';
import { setupWellKnown } from './http-well-known.js';
import { setupApiRoutes } from './http-api-routes.js';
import { setupMcpRoutes, McpServerFactory } from './http-mcp-handler.js';
import { setupErrorHandlers } from './http-error-handlers.js';
import { startHttpServerWithErrorHandling } from './http-server-startup.js';
import { qdrantService } from '../services/qdrant/index.js';

export function startHttpServer(port: number, serverFactory: McpServerFactory, memoryStore: MemoryQdrantStore) {
    const app = express();

    // Configure middleware
    configureMiddleware(app);
    setupAuthCallback(app);

    // Well-known must be registered before auth middleware so RFC 9728 discovery
    // is reachable without credentials (MCP clients call it before authenticating).
    setupWellKnown(app);

    app.use(authMiddleware);

    // Protected route handlers (require auth when AUTH_ENABLED)
    setupHealthRoutes(app, memoryStore);
    setupApiRoutes(app, memoryStore, { qdrantService });
    setupMcpRoutes(app, serverFactory);
    setupErrorHandlers(app);

    // Start server with error handling
    return startHttpServerWithErrorHandling(app, port);
}

export async function startServer(serverFactory: McpServerFactory, memoryStore: MemoryQdrantStore) {
    const httpPort = PORT;

    structuredLogger.success('🚀 KAIROS MCP Server starting', 'HTTP transport only');
    structuredLogger.info('HTTP transport: enabled');
    structuredLogger.info('Port: ' + httpPort);

    startHttpServer(httpPort, serverFactory, memoryStore);
}