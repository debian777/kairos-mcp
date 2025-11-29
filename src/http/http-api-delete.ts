import express from 'express';
import { structuredLogger } from '../utils/structured-logger.js';
import type { QdrantService } from '../services/qdrant/service.js';

/**
 * Set up API route for kairos_delete
 * @param app Express application instance
 * @param qdrantService Qdrant service instance
 */
export function setupDeleteRoute(app: express.Express, qdrantService: QdrantService) {
    app.post('/api/kairos_delete', async (req, res) => {
        const startTime = Date.now();

        try {
            const { uris } = req.body;

            if (!uris || !Array.isArray(uris) || uris.length === 0) {
                res.status(400).json({
                    error: 'INVALID_INPUT',
                    message: 'uris is required and must be a non-empty array'
                });
                return;
            }

            structuredLogger.info(`→ POST /api/kairos_delete (${uris.length} URI(s))`);

            const results: any[] = [];
            let totalDeleted = 0;
            let totalFailed = 0;

            for (const uri of uris) {
                try {
                    const uuid = typeof uri === 'string' ? uri.split('/').pop() : undefined;
                    if (!uuid) {
                        throw new Error('Invalid URI format');
                    }

                    await qdrantService.deleteMemory(uuid);

                    results.push({
                        uri,
                        status: 'deleted',
                        message: `Memory ${uri} deleted successfully`
                    });
                    totalDeleted++;
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    results.push({
                        uri,
                        status: 'error',
                        message: `Failed to delete memory: ${errorMessage}`
                    });
                    totalFailed++;
                }
            }

            const duration = Date.now() - startTime;
            structuredLogger.info(`✓ kairos_delete completed in ${duration}ms (${totalDeleted} deleted, ${totalFailed} failed)`);

            res.status(200).json({
                results,
                total_deleted: totalDeleted,
                total_failed: totalFailed,
                metadata: { duration_ms: duration }
            });

        } catch (error) {
            const duration = Date.now() - startTime;
            structuredLogger.error(`✗ kairos_delete failed in ${duration}ms`, error);
            res.status(500).json({
                error: 'DELETE_FAILED',
                message: error instanceof Error ? error.message : 'Failed to delete memories',
                duration_ms: duration
            });
        }
    });
}


