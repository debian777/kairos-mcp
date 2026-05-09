import express from 'express';
import { MemoryQdrantStore } from '../services/memory/store.js';
import { structuredLogger } from '../utils/structured-logger.js';
import { APP_LISTEN_PORT_SPEC } from '../config.js';

// Import modular components
import { configureMiddleware } from './http-server-config.js';
import { authMiddleware } from './http-auth-middleware.js';
import { setupAuthCallback } from './http-auth-callback.js';
import { setupHealthRoutes } from './http-health-routes.js';
import { setupWellKnown } from './http-well-known.js';
import { setupApiRoutes } from './http-api-routes.js';
import { setupMcpRoutes } from './http-mcp-handler.js';
import { setupUiStatic } from './http-ui-static.js';
import { setupExportDownloadRoutes } from './http-export-download-routes.js';
import { setupErrorHandlers } from './http-error-handlers.js';
import { startHttpServerWithErrorHandling } from './http-server-startup.js';
import { qdrantService } from '../services/qdrant/index.js';

export async function startHttpServer(
  listenSpec: number | 'auto',
  memoryStore: MemoryQdrantStore
): Promise<number> {
    const app = express();

    // Configure middleware
    configureMiddleware(app);
    setupAuthCallback(app);

    // Well-known must be registered before auth middleware so RFC 9728 discovery
    // is reachable without credentials (MCP clients call it before authenticating).
    setupWellKnown(app);

    app.use(authMiddleware);

    // Route handlers after auth middleware; capability download is outside `/api` auth.
    setupHealthRoutes(app, memoryStore);
    setupExportDownloadRoutes(app, memoryStore, qdrantService);
    setupApiRoutes(app, memoryStore, { qdrantService });
    setupMcpRoutes(app, memoryStore);
    setupUiStatic(app);
    setupErrorHandlers(app);

    const { listenPort } = await startHttpServerWithErrorHandling(app, listenSpec);
    return listenPort;
}

export async function startServer(memoryStore: MemoryQdrantStore): Promise<number> {
    structuredLogger.success('🚀 KAIROS MCP Server starting', 'HTTP transport only');
    structuredLogger.info('HTTP transport: enabled');
    if (APP_LISTEN_PORT_SPEC === 'auto') {
        structuredLogger.info('Port: AUTO (ephemeral — actual port logged when listen succeeds)');
    } else {
        structuredLogger.info('Port: ' + APP_LISTEN_PORT_SPEC);
    }

    return await startHttpServer(APP_LISTEN_PORT_SPEC, memoryStore);
}