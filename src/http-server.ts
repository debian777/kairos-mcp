import express from 'express';
import { MemoryQdrantStore } from './services/memory/store.js';
import { structuredLogger } from './utils/structured-logger.js';
import { PORT } from './config.js';

// Import modular components
import { configureMiddleware } from './http-server-config.js';
import { setupHealthRoutes } from './http-health-routes.js';
import { setupApiRoutes } from './http-api-routes.js';
import { setupMcpRoutes } from './http-mcp-handler.js';
import { setupErrorHandlers } from './http-error-handlers.js';
import { startHttpServerWithErrorHandling } from './http-server-startup.js';
import { qdrantService } from './services/qdrant/index.js';

export function startHttpServer(port: number, server: any, memoryStore: MemoryQdrantStore) {
    const app = express();

    // Configure middleware
    configureMiddleware(app);

    // Set up all route handlers
    setupHealthRoutes(app, memoryStore);
    setupApiRoutes(app, memoryStore, { qdrantService });
    setupMcpRoutes(app, server);
    setupErrorHandlers(app);

    // Start server with error handling
    return startHttpServerWithErrorHandling(app, port);
}

export async function startServer(server: any, memoryStore: MemoryQdrantStore) {
    const httpPort = PORT;

    structuredLogger.success('🚀 KAIROS MCP Server starting', 'HTTP transport only');
    structuredLogger.info('HTTP transport: enabled');
    structuredLogger.info('Port: ' + httpPort);

    startHttpServer(httpPort, server, memoryStore);
}