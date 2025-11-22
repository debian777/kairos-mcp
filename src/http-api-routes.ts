import getRawBody from 'raw-body';
import express from 'express';
import { MemoryQdrantStore } from './services/memory/store.js';
import { leaderboardHtml } from './resources/content/leaderboard.js';
import { structuredLogger } from './utils/structured-logger.js';

/**
 * Set up API routes for leaderboard, achievements, and raw markdown ingestion
 * @param app Express application instance
 * @param memoryStore Memory store instance
 */
export function setupApiRoutes(app: express.Express, memoryStore: MemoryQdrantStore) {
    // Modern Leaderboard Interface for Humans
    app.get('/leaderboard', (req, res) => {
        try {
            res.setHeader('Content-Type', 'text/html');
            res.send(leaderboardHtml);
        } catch (err) {
            structuredLogger.error('Failed to send embedded leaderboard HTML', err instanceof Error ? err.message : String(err));
            res.status(500).send('<h1>Failed to load leaderboard</h1>');
        }
    });

    // Direct API endpoint for leaderboard data (bypassing MCP)
    app.get('/api/leaderboard', async (req, res) => {
        try {
            const { getLeaderboardData } = await import('./services/game/leaderboard-api.js');
            const data = await getLeaderboardData();
            res.json(data);
        } catch (err) {
            structuredLogger.error('Failed to fetch leaderboard data', err instanceof Error ? err.message : String(err));
            res.status(500).json({ error: 'Failed to fetch leaderboard data' });
        }
    });

    // Direct API endpoint for achievements data (bypassing MCP)
    app.get('/api/achievements', async (req, res) => {
        try {
            const { getAchievementsData } = await import('./services/game/leaderboard-api.js');
            const data = getAchievementsData();
            res.json(data);
        } catch (err) {
            structuredLogger.error('Failed to fetch achievements data', err instanceof Error ? err.message : String(err));
            res.status(500).json({ error: 'Failed to fetch achievements data' });
        }
    });

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
}