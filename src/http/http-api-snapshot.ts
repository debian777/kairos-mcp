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
/** 503 when backup directory is not configured. */
const SNAPSHOT_NOT_CONFIGURED_MESSAGE = 'Backup directory is not defined in server settings.';

export function setupSnapshotRoute(app: express.Express, qdrantService: QdrantService) {
    app.post('/api/snapshot', async (_req, res) => {
        if (!QDRANT_SNAPSHOT_DIR) {
            res.status(503).json({
                error: 'Backup not configured',
                message: SNAPSHOT_NOT_CONFIGURED_MESSAGE
            });
            return;
        }

        const result = await triggerQdrantSnapshot(qdrantService, {
            enabled: true,
            directory: QDRANT_SNAPSHOT_DIR,
            reason: 'api'
        });

        const statusCode = result.success ? 200 : result.skipped ? 202 : 503;
        res.status(statusCode).json({
            status: result.success ? 'completed' : result.skipped ? 'skipped' : 'failed',
            target: 'qdrant',
            snapshotName: result.snapshotName,
            filePath: result.filePath,
            bytesWritten: result.bytesWritten,
            durationMs: result.durationMs,
            message: result.message
        });
    });
}


