import express from 'express';
import { MemoryQdrantStore } from '../services/memory/store.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { executeDump } from '../tools/kairos_dump.js';
import { structuredLogger } from '../utils/structured-logger.js';

/**
 * Set up API route for kairos_dump
 */
export function setupDumpRoute(
  app: express.Express,
  memoryStore: MemoryQdrantStore,
  qdrantService: QdrantService
): void {
  app.post('/api/kairos_dump', async (req, res) => {
    const startTime = Date.now();
    try {
      const { uri, protocol } = req.body;
      if (!uri || typeof uri !== 'string' || uri.trim().length === 0) {
        res.status(400).json({
          error: 'INVALID_INPUT',
          message: 'uri is required and must be a non-empty string'
        });
        return;
      }
      structuredLogger.info(`-> POST /api/kairos_dump (uri: ${uri}, protocol: ${protocol})`);
      const payload = await executeDump(memoryStore, qdrantService, {
        uri: uri.trim(),
        protocol: Boolean(protocol)
      });
      const duration = Date.now() - startTime;
      res.status(200).json({ ...payload, metadata: { duration_ms: duration } });
    } catch (error: unknown) {
      const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
      const message = error instanceof Error ? error.message : String(error);
      structuredLogger.debug(`kairos_dump HTTP error: ${error instanceof Error ? error.message : String(error)}`);
      res.status(statusCode).json({ error: statusCode === 404 ? 'NOT_FOUND' : 'DUMP_FAILED', message });
    }
  });
}
