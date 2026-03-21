import express from 'express';
import { structuredLogger } from '../utils/structured-logger.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { executeDelete } from '../tools/delete.js';
import { deleteInputSchema } from '../tools/delete_schema.js';

/**
 * Set up API route for delete. Uses shared executeDelete; returns same shape as MCP (no metadata).
 */
export function setupDeleteRoute(app: express.Express, qdrantService: QdrantService) {
  app.post('/api/delete', async (req, res) => {
    try {
      const input = deleteInputSchema.safeParse(req.body);
      if (!input.success) {
        res.status(400).json({
          error: 'INVALID_INPUT',
          message: input.error.message ?? 'uris is required and must be a non-empty array'
        });
        return;
      }

      structuredLogger.info(`→ POST /api/delete (${input.data.uris.length} URI(s))`);
      const result = await executeDelete(qdrantService, input.data);
      structuredLogger.info(`✓ delete completed (${result.total_deleted} deleted, ${result.total_failed} failed)`);
      res.status(200).json(result);
    } catch (error) {
      structuredLogger.error('✗ delete failed', error);
      res.status(500).json({
        error: 'DELETE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to delete memories'
      });
    }
  });
}


