import express from 'express';
import { MemoryQdrantStore } from '../services/memory/store.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { setupMintRoute } from './http-api-mint.js';
import { setupSnapshotRoute } from './http-api-snapshot.js';
import { setupBeginRoute } from './http-api-begin.js';
import { setupBeginStepRoute } from './http-api-begin-step.js';
import { setupNextRoute } from './http-api-next.js';
import { setupAttestRoute } from './http-api-attest.js';
import { setupUpdateRoute } from './http-api-update.js';
import { setupDeleteRoute } from './http-api-delete.js';
import { setupDumpRoute } from './http-api-dump.js';

/**
 * Set up all API routes
 * @param app Express application instance
 * @param memoryStore Memory store instance
 * @param deps Dependencies including qdrantService
 */
export function setupApiRoutes(app: express.Express, memoryStore: MemoryQdrantStore, deps: { qdrantService: QdrantService }) {
    const { qdrantService } = deps;

    setupMintRoute(app, memoryStore);
    setupSnapshotRoute(app, qdrantService);
    setupBeginRoute(app, memoryStore, qdrantService); // /api/kairos_search
    setupBeginStepRoute(app, memoryStore, qdrantService); // /api/kairos_begin
    setupNextRoute(app, memoryStore, qdrantService);
    setupAttestRoute(app, qdrantService);
    setupUpdateRoute(app, qdrantService);
    setupDeleteRoute(app, qdrantService);
    setupDumpRoute(app, memoryStore, qdrantService);
}