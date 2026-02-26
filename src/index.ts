/**
 * KAIROS MCP Server
 *
 * Supporting HTTP transport only (STDIO removed for simplicity)
 */

import { structuredLogger } from './utils/structured-logger.js';
import { installGlobalErrorHandlers } from './utils/global-error-handlers.js';
import { logger } from './utils/logger.js';
import { MemoryQdrantStore } from './services/memory/store.js';
import { createServer } from './server.js';
import { startServer } from './http/http-server.js';
import { injectMemResourcesAtBoot } from './resources/mem-resources-boot.js';
import { startMetricsServer } from './metrics-server.js';
import { PORT, METRICS_PORT, QDRANT_SNAPSHOT_ON_START, QDRANT_SNAPSHOT_DIR } from './config.js';
import { qdrantService } from './services/qdrant/index.js';
import { triggerQdrantSnapshot } from './services/qdrant/snapshots.js';
// Import system metrics to ensure they're initialized
import './services/metrics/system-metrics.js';

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

async function main(): Promise<void> {
    try {
        // Install once at startup to capture any background errors/warnings
        installGlobalErrorHandlers();

        const memoryStore = new MemoryQdrantStore();

        // Wait for Qdrant to be available before initializing
        await waitForQdrant(memoryStore);

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

        const serverFactory = () => createServer(memoryStore);
        await startServer(serverFactory, memoryStore);
    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        // Prefer structured HTTP logger for fatal errors
        try {
            structuredLogger.error('Fatal error during KAIROS MCP startup', error);
        } catch {
            // Ignore logging failures from structured logger
        }

        // Fallback to generic logger (stdio-safe)
        try {
            logger.error('Fatal error during KAIROS MCP startup', error);
        } catch {
            // Ignore logging failures from generic logger
        }

        // Ensure non-zero exit so supervisors can detect failure
        process.exitCode = 1;
    }
}

await main();
