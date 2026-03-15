import express from 'express';
import { MemoryQdrantStore } from '../services/memory/store.js';
import { structuredLogger } from '../utils/structured-logger.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { searchInputSchema } from '../tools/kairos_search_schema.js';
import { executeSearch } from '../tools/kairos_search.js';

/**
 * Set up API route for kairos_search (V2 unified response).
 * Validates with canonical schema and returns executeSearch result only (no metadata).
 */
export function setupBeginRoute(app: express.Express, memoryStore: MemoryQdrantStore, qdrantService: QdrantService): void {
  app.post('/api/kairos_search', async (req, res) => {
    try {
      const parsed = searchInputSchema.safeParse(req.body);
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

      structuredLogger.info(`-> POST /api/kairos_search (query: ${parsed.data.query})`);
      const result = await executeSearch(memoryStore, qdrantService, parsed.data);
      res.status(200).json(result);
    } catch (error) {
      structuredLogger.error('kairos_search failed', error);
      res.status(500).json({
        error: 'SEARCH_FAILED',
        message: error instanceof Error ? error.message : 'Failed to search for chain heads'
      });
    }
  });
}
