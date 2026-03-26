import express from 'express';
import { structuredLogger } from '../utils/structured-logger.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { executeTune } from '../tools/tune.js';
import { tuneInputSchema } from '../tools/tune_schema.js';

/**
 * Set up API route for tune.
 */
export function setupUpdateRoute(app: express.Express, qdrantService: QdrantService) {
  app.post('/api/tune', async (req, res) => {
    try {
      const input = tuneInputSchema.safeParse(req.body);
      if (!input.success) {
        res.status(400).json({
          error: 'INVALID_INPUT',
          message: input.error.message ?? 'uris is required and must be a non-empty array'
        });
        return;
      }
      structuredLogger.info(`→ POST /api/tune (${input.data.uris.length} URI(s))`);
      const result = await executeTune(qdrantService, input.data);
      structuredLogger.info(`✓ tune completed (${result.total_updated} updated, ${result.total_failed} failed)`);
      res.status(200).json(result);
    } catch (error) {
      structuredLogger.error('✗ tune failed', error);
      res.status(500).json({
        error: 'TUNE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to update adapter layers'
      });
    }
  });
}


