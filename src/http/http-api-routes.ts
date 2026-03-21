import express from 'express';
import { MemoryQdrantStore } from '../services/memory/store.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { setupMintRoute } from './http-api-mint.js';
import { setupSnapshotRoute } from './http-api-snapshot.js';
import { setupBeginRoute } from './http-api-begin.js';
import { setupBeginStepRoute } from './http-api-begin-step.js';
import { setupAttestRoute } from './http-api-attest.js';
import { setupUpdateRoute } from './http-api-update.js';
import { setupDeleteRoute } from './http-api-delete.js';
import { setupDumpRoute } from './http-api-dump.js';
import { setupMeRoute } from './http-api-me.js';
import { setupSpacesRoute } from './http-api-spaces.js';

/**
 * Set up all API routes
 * @param app Express application instance
 * @param memoryStore Memory store instance
 * @param deps Dependencies including qdrantService
 */
export function setupApiRoutes(app: express.Express, memoryStore: MemoryQdrantStore, deps: { qdrantService: QdrantService }) {
    const { qdrantService } = deps;

    setupMeRoute(app);
    setupSpacesRoute(app, memoryStore);
    setupMintRoute(app, memoryStore);
    setupSnapshotRoute(app, qdrantService);
    setupBeginRoute(app, memoryStore, qdrantService); // /api/activate
    setupBeginStepRoute(app, memoryStore, qdrantService); // /api/forward
    setupAttestRoute(app, qdrantService); // /api/reward
    setupUpdateRoute(app, qdrantService); // /api/tune
    setupDeleteRoute(app, qdrantService);
    setupDumpRoute(app, memoryStore, qdrantService);
}