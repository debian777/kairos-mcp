/**
 * KAIROS MCP Server
 *
 * Supporting HTTP transport only (STDIO removed for simplicity)
 */

import { structuredLogger } from './utils/structured-logger.js';
import { installGlobalErrorHandlers } from './utils/global-error-handlers.js';
import { MemoryQdrantStore } from './services/memory/store.js';
import { startServer } from './http/http-server.js';
import { injectMemResourcesAtBoot } from './resources/mem-resources-boot.js';
import { startMetricsServer } from './metrics-server.js';
import {
  PORT,
  METRICS_PORT,
  QDRANT_SNAPSHOT_ON_START,
  QDRANT_SNAPSHOT_DIR,
  KAIROS_LOCAL_ARTIFACT_DIRS
} from './config.js';
import { qdrantService } from './services/qdrant/index.js';
import { triggerQdrantSnapshot } from './services/qdrant/snapshots.js';
import { probeEmbeddingDimension } from './services/embedding/service.js';
import { installQdrantFetchCompatibility } from './services/qdrant/undici-compat.js';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
// Import system metrics to ensure they're initialized
import './services/metrics/system-metrics.js';

/** True when this file is the process entrypoint (e.g. `node dist/index.js`, container CMD). */
function isDirectRun(): boolean {
    const entry = process.argv[1];
    if (!entry) return false;
    try {
        return import.meta.url === pathToFileURL(path.resolve(entry)).href;
    } catch {
        return false;
    }
}

/**
 * Wait for Qdrant to be available with retries
 * Uses shorter intervals for faster detection when Qdrant becomes available quickly
 */
async function waitForQdrant(memoryStore: MemoryQdrantStore, maxRetries: number = 30, intervalMs: number = 1000): Promise<void> {
    structuredLogger.info('Waiting for Qdrant to be available...');
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const isHealthy = await memoryStore.checkHealth(5000); // 5 second timeout per check
            if (isHealthy) {
                structuredLogger.info(`Qdrant is available after ${attempt} attempt(s)`);
                return;
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            structuredLogger.debug(`Qdrant health check error on attempt ${attempt}: ${errorMessage}`);
            // Health check failed, will retry
        }
        
        if (attempt < maxRetries) {
            structuredLogger.info(`Qdrant not ready yet (attempt ${attempt}/${maxRetries}), retrying in ${intervalMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
    }
    
    throw new Error(`Qdrant did not become available after ${maxRetries} attempts (${maxRetries * intervalMs / 1000}s)`);
}

/**
 * Boot the HTTP/MCP application.
 * Invoked when `node dist/index.js` is the process entrypoint, or after `dist/bootstrap.js` loads this module
 * (bootstrap is not `index.js`, so `isDirectRun()` is false there and bootstrap must call this explicitly).
 */
export async function runKairosServer(): Promise<void> {
    try {
        installQdrantFetchCompatibility();
        // Install once at startup to capture any background errors/warnings
        installGlobalErrorHandlers();

        structuredLogger.info(
          `KAIROS_LOCAL_ARTIFACT_DIRS (client-resolvable hints): ${KAIROS_LOCAL_ARTIFACT_DIRS.join(', ')}`
        );

        const memoryStore = new MemoryQdrantStore();

        // Wait for Qdrant to be available before initializing
        await waitForQdrant(memoryStore);

        const embeddingDim = await probeEmbeddingDimension();
        structuredLogger.info(`Embedding dimension resolved: ${embeddingDim}`);

        structuredLogger.info('Initializing Qdrant memory store...');
        await memoryStore.init();
        structuredLogger.info('Memory store ready');

        if (QDRANT_SNAPSHOT_ON_START) {
            const snapshotResult = await triggerQdrantSnapshot(qdrantService, {
                enabled: true,
                directory: QDRANT_SNAPSHOT_DIR,
                reason: 'startup'
            });

            if (!snapshotResult.success) {
                structuredLogger.warn(`Startup snapshot failed: ${snapshotResult.message || 'unknown error'}`);
            }
        } else {
            structuredLogger.info('Startup snapshot disabled (QDRANT_SNAPSHOT_ON_START=false)');
        }

        // Inject mem resources from embedded-mcp-resources into Qdrant at boot
        // Use --force flag to allow override in new versions
        await injectMemResourcesAtBoot(memoryStore, { force: true });

        // Start dedicated metrics server on separate port
        // This runs independently from the main application server
        startMetricsServer();

        structuredLogger.info(`Application server: ${PORT}`);
        structuredLogger.info(`Metrics server: ${METRICS_PORT} (isolated)`);

        await startServer(memoryStore);
    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        try {
            structuredLogger.error('Fatal error during KAIROS MCP startup', error);
        } catch {
            // Ignore logging failures
        }

        // Ensure non-zero exit so supervisors can detect failure
        process.exitCode = 1;
    }
}

if (isDirectRun()) {
    await runKairosServer();
}
