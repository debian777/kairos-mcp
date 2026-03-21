import express from 'express';
import { MemoryQdrantStore } from '../services/memory/store.js';
import { structuredLogger } from '../utils/structured-logger.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { beginInputSchema, executeBegin } from '../tools/kairos_begin.js';
import { KairosError } from '../types/index.js';

/**
 * Set up API route for kairos_begin (V2: auto-redirect, no next_step/protocol_status/attest_required).
 * Validates with canonical schema and returns executeBegin result only (no metadata).
 */
export function setupBeginStepRoute(app: express.Express, memoryStore: MemoryQdrantStore, qdrantService: QdrantService): void {
  app.post('/api/kairos_begin', async (req, res) => {
    try {
      const parsed = beginInputSchema.safeParse(req.body);
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

      const logRef = parsed.data.uri?.trim() ? `uri: ${parsed.data.uri}` : `key: ${parsed.data.key}`;
      structuredLogger.info(`-> POST /api/kairos_begin (${logRef})`);
      const result = await executeBegin(memoryStore, qdrantService, parsed.data);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof KairosError) {
        structuredLogger.warn(`kairos_begin ${error.code}: ${error.message}`);
        res.status(error.statusCode).json({
          error: error.code,
          message: error.message,
          ...(error.details && typeof error.details === 'object' ? error.details : {})
        });
        return;
      }
      structuredLogger.error('kairos_begin failed', error);
      res.status(500).json({
        error: 'BEGIN_FAILED',
        message: error instanceof Error ? error.message : 'Failed to get step 1'
      });
    }
  });
}
