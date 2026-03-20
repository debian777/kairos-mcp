import express from 'express';
import { MemoryQdrantStore } from '../services/memory/store.js';
import { structuredLogger } from '../utils/structured-logger.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { kairosNextInputSchema } from '../tools/kairos_next_schema.js';
import { executeNext, buildMissingSolutionPayload } from '../tools/kairos_next.js';

/**
 * Set up API route for kairos_next (V2: no next_step/protocol_status/attest_required/final_challenge).
 * Validates with canonical schema and returns executeNext result only (no metadata).
 */
export function setupNextRoute(app: express.Express, memoryStore: MemoryQdrantStore, qdrantService: QdrantService): void {
  app.post('/api/kairos_next', async (req, res) => {
    try {
      const uri = req.body?.uri;
      if (!uri || typeof uri !== 'string') {
        res.status(400).json({ error: 'INVALID_INPUT', message: 'uri is required and must be a string' });
        return;
      }

      if (req.body?.solution == null) {
        structuredLogger.info(
          { uri, event: 'kairos_next_request' },
          '-> POST /api/kairos_next (no solution)'
        );
        const result = await buildMissingSolutionPayload(memoryStore, uri);
        res.status(200).json(result);
        return;
      }

      const parsed = kairosNextInputSchema.safeParse(req.body);
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

      structuredLogger.info(
        { uri: parsed.data.uri, event: 'kairos_next_request' },
        '-> POST /api/kairos_next'
      );
      const result = await executeNext(memoryStore, qdrantService, parsed.data, 'http');
      res.status(200).json(result);
      return;
    } catch (error) {
      structuredLogger.error('kairos_next failed', error);
      res.status(500).json({
        error: 'NEXT_FAILED',
        message: error instanceof Error ? error.message : 'Failed to get next step'
      });
    }
  });
}
