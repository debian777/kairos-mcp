import express from 'express';
import { MemoryQdrantStore } from '../services/memory/store.js';
import { structuredLogger } from '../utils/structured-logger.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { executeBegin } from '../services/kairos-orchestration.js';

/**
 * Set up API route for kairos_begin (V2: auto-redirect, no next_step/protocol_status/attest_required).
 * Uses shared executeBegin so behavior matches MCP.
 */
export function setupBeginStepRoute(app: express.Express, memoryStore: MemoryQdrantStore, qdrantService: QdrantService): void {
  app.post('/api/kairos_begin', async (req, res) => {
    const startTime = Date.now();

    try {
      const { uri } = req.body;

      if (!uri || typeof uri !== 'string') {
        res.status(400).json({
          error: 'INVALID_INPUT',
          message: 'uri is required and must be a string'
        });
        return;
      }

      structuredLogger.info(`-> POST /api/kairos_begin (uri: ${uri})`);

      const output = await executeBegin(memoryStore, uri, { qdrantService });

      const duration = Date.now() - startTime;
      structuredLogger.info(`kairos_begin completed in ${duration}ms`);

      res.status(200).json({
        ...output,
        metadata: { duration_ms: duration }
      });
      return;
    } catch (error) {
      const duration = Date.now() - startTime;
      structuredLogger.error(`kairos_begin failed in ${duration}ms`, error);
      res.status(500).json({
        error: 'BEGIN_FAILED',
        message: error instanceof Error ? error.message : 'Failed to get step 1',
        duration_ms: duration
      });
      return;
    }
  });
}
