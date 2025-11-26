import getRawBody from 'raw-body';
import express from 'express';
import { MemoryQdrantStore } from './services/memory/store.js';
import { structuredLogger } from './utils/structured-logger.js';
import type { QdrantService } from './services/qdrant/service.js';
import { triggerQdrantSnapshot } from './services/qdrant/snapshots.js';
import { QDRANT_SNAPSHOT_DIR } from './config.js';

/**
 * Set up API routes for raw markdown ingestion
 * @param app Express application instance
 * @param memoryStore Memory store instance
 */
export function setupApiRoutes(app: express.Express, memoryStore: MemoryQdrantStore, deps: { qdrantService: QdrantService }) {
    const { qdrantService } = deps;

    // REST API endpoint for raw markdown ingestion
    app.post('/api/kairos_mint/raw', async (req, res) => {
        const startTime = Date.now();

        try {
            // Parse raw markdown body
            const contentLength = req.headers['content-length'] ? parseInt(req.headers['content-length'], 10) : null;
            const options: any = {
                limit: '10mb',
                encoding: 'utf8'
            };
            if (contentLength !== null) {
                options.length = contentLength;
            }
            const rawBody = await getRawBody(req, options);

            const markdown = String(rawBody);

            if (!markdown || markdown.trim().length === 0) {
                res.status(400).json({
                    error: 'INVALID_INPUT',
                    message: 'Empty markdown content'
                });
                return;
            }

            // Extract parameters from query string or headers
            const llm_model_id = (req.query['llm_model_id'] as string) ||
                req.headers['x-llm-model-id'] as string ||
                req.headers['user-agent'] ||
                'http-api';

            const force_update = req.query['force'] === 'true' ||
                req.headers['x-force-update'] === 'true';

            structuredLogger.info(`→ POST /api/kairos_mint/raw (${markdown.length} bytes, model: ${llm_model_id}, force: ${force_update})`);

            // Store using the same logic as kairos_mint MCP tool
            const memories = await memoryStore.storeChain([markdown], llm_model_id, {
                forceUpdate: force_update
            } as any);

            const duration = Date.now() - startTime;
            structuredLogger.info(`✓ Stored ${memories.length} memories in ${duration}ms`);

            // Return success response
            res.status(200).json({
                status: 'stored',
                items: memories.map(memory => ({
                    uri: `kairos://mem/${memory.memory_uuid}`,
                    memory_uuid: memory.memory_uuid,
                    label: memory.label,
                    tags: memory.tags
                })),
                metadata: {
                    count: memories.length,
                    duration_ms: duration,
                    llm_model_id
                }
            });

        } catch (error) {
            const duration = Date.now() - startTime;
            const err = error as any;

            // Handle duplicate chain error
            if (err && (err.code === 'DUPLICATE_CHAIN' || err.code === 'DUPLICATE_KEY')) {
                structuredLogger.warn(`✗ Duplicate chain in ${duration}ms: ${err.message}`);
                res.status(409).json({
                    error: 'DUPLICATE_CHAIN',
                    message: 'Memory chain with this label already exists. Use force=true to overwrite.',
                    ...(err.details || {})
                });
                return;
            }

            // Handle other errors
            structuredLogger.error(`✗ Store failed in ${duration}ms`, error);
            res.status(500).json({
                error: 'STORE_FAILED',
                message: err?.message || 'Failed to store markdown',
                duration_ms: duration
            });
        }
    });

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