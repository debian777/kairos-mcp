import express from 'express';
import { MemoryQdrantStore } from '../services/memory/store.js';
import { structuredLogger } from '../utils/structured-logger.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { activateInputSchema } from '../tools/activate_schema.js';
import { executeActivate } from '../tools/activate.js';

/**
 * Set up API route for activate.
 * Validates with canonical schema and returns executeSearch result only (no metadata).
 */
export function setupActivateRoute(app: express.Express, memoryStore: MemoryQdrantStore, qdrantService: QdrantService): void {
  app.post('/api/activate', async (req, res) => {
    try {
      const parsed = activateInputSchema.safeParse(req.body);
      if (!parsed.success) {
        const first = parsed.error.flatten().fieldErrors;
        const msg = Object.keys(first).length
          ? Object.entries(first)
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
              .join('; ')
          : parsed.error.message;
        res.status(400).json({ error: 'INVALID_INPUT', message: msg });
        return;
      }

      structuredLogger.info(`-> POST /api/activate (query: ${parsed.data.query})`);
      const result = await executeActivate(memoryStore, qdrantService, parsed.data);
      res.status(200).json(result);
    } catch (error) {
      structuredLogger.error('activate failed', error);
      res.status(500).json({
        error: 'ACTIVATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to activate an adapter'
      });
    }
  });
}
