import express from 'express';
import { MemoryQdrantStore } from '../services/memory/store.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { executeExport } from '../tools/export.js';
import { exportInputSchema } from '../tools/export_schema.js';
import { structuredLogger } from '../utils/structured-logger.js';

function requestBaseUrl(req: express.Request): string | undefined {
  const host = req.get('x-forwarded-host') ?? req.get('host');
  if (!host) return undefined;
  const proto = req.get('x-forwarded-proto') ?? req.protocol;
  return `${proto}://${host}`;
}

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
        {
          event: 'export_http_request',
          format: parsed.data.format,
          uri: parsed.data.uri,
          adapters_len: parsed.data.adapters?.length,
          all_adapters: parsed.data.all_adapters,
          space_name: parsed.data.space_name
        },
        'POST /api/export'
      );
      const baseUrl = requestBaseUrl(req);
      const payload = await executeExport(
        memoryStore,
        qdrantService,
        parsed.data,
        baseUrl ? { downloadBaseUrl: baseUrl } : {}
      );
      res.status(200).json(payload);
    } catch (error: unknown) {
      const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
      const message = error instanceof Error ? error.message : String(error);
      structuredLogger.debug(`export HTTP error: ${error instanceof Error ? error.message : String(error)}`);
      if (res.headersSent) {
        res.end();
        return;
      }
      res.status(statusCode).json({ error: statusCode === 404 ? 'NOT_FOUND' : 'EXPORT_FAILED', message });
    }
  });
}
