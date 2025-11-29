import express from 'express';
import { structuredLogger } from '../utils/structured-logger.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { triggerQdrantSnapshot } from '../services/qdrant/snapshots.js';
import { QDRANT_SNAPSHOT_DIR } from '../config.js';

/**
 * Set up API route for Qdrant snapshot
 * @param app Express application instance
 * @param qdrantService Qdrant service instance
 */
export function setupSnapshotRoute(app: express.Express, qdrantService: QdrantService) {
    app.post('/api/snapshot', async (_req, res) => {
        try {
            const result = await triggerQdrantSnapshot(qdrantService, {
                enabled: true,
                directory: QDRANT_SNAPSHOT_DIR,
                reason: 'api'
            });

            const statusCode = result.success ? 200 : result.skipped ? 202 : 502;
            res.status(statusCode).json({
                status: result.success ? 'completed' : result.skipped ? 'skipped' : 'failed',
                target: 'qdrant',
                snapshotName: result.snapshotName,
                filePath: result.filePath,
                bytesWritten: result.bytesWritten,
                durationMs: result.durationMs,
                message: result.message
            });
        } catch (error) {
            structuredLogger.error('Snapshot endpoint crashed', error);
            res.status(500).json({
                status: 'failed',
                target: 'qdrant',
                message: error instanceof Error ? error.message : 'Snapshot pipeline crashed'
            });
        }
    });
}


