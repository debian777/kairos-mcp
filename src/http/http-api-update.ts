import express from 'express';
import { structuredLogger } from '../utils/structured-logger.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { executeUpdate } from '../tools/kairos_update.js';
import { updateInputSchema } from '../tools/kairos_update_schema.js';

/**
 * Set up API route for kairos_update. Uses shared executeUpdate; returns same shape as MCP (no metadata).
 */
export function setupUpdateRoute(app: express.Express, qdrantService: QdrantService) {
  app.post('/api/kairos_update', async (req, res) => {
    try {
      const input = updateInputSchema.safeParse(req.body);
      if (!input.success) {
        res.status(400).json({
          error: 'INVALID_INPUT',
          message: input.error.message ?? 'uris is required and must be a non-empty array'
        });
        return;
      }
      structuredLogger.info(`→ POST /api/kairos_update (${input.data.uris.length} URI(s))`);
      const result = await executeUpdate(qdrantService, input.data);
      structuredLogger.info(`✓ kairos_update completed (${result.total_updated} updated, ${result.total_failed} failed)`);
      res.status(200).json(result);
    } catch (error) {
      structuredLogger.error('✗ kairos_update failed', error);
      res.status(500).json({
        error: 'UPDATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to update memories'
      });
    }
  });
}


