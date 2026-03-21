import express from 'express';
import { MemoryQdrantStore } from '../services/memory/store.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { executeExport } from '../tools/export.js';
import { exportInputSchema } from '../tools/export_schema.js';
import { structuredLogger } from '../utils/structured-logger.js';

/**
 * Set up API route for export
 */
export function setupDumpRoute(
  app: express.Express,
  memoryStore: MemoryQdrantStore,
  qdrantService: QdrantService
): void {
  app.post('/api/export', async (req, res) => {
    try {
      const parsed = exportInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'INVALID_INPUT',
          message: parsed.error.message
        });
        return;
      }
      structuredLogger.info(
        { uri: parsed.data.uri, format: parsed.data.format, event: 'export_request' },
        '-> POST /api/export'
      );
      const payload = await executeExport(memoryStore, qdrantService, parsed.data);
      res.status(200).json(payload);
    } catch (error: unknown) {
      const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
      const message = error instanceof Error ? error.message : String(error);
      structuredLogger.debug(`export HTTP error: ${error instanceof Error ? error.message : String(error)}`);
      res.status(statusCode).json({ error: statusCode === 404 ? 'NOT_FOUND' : 'EXPORT_FAILED', message });
    }
  });
}
