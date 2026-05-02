import express from 'express';
import { MemoryQdrantStore } from '../services/memory/store.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { verifyExportDownloadCapability } from '../services/export-download-capability.js';
import { streamSkillZipHttpResponse } from './export-skill-zip-http.js';
import { structuredLogger } from '../utils/structured-logger.js';
import { runWithSpaceContextAsync } from '../utils/tenant-context.js';

export function setupExportDownloadRoutes(
  app: express.Express,
  memoryStore: MemoryQdrantStore,
  qdrantService: QdrantService
): void {
  app.get('/export/skill-zip/:opaque', async (req, res) => {
    const opaque = req.params['opaque'] ?? '';
    const record = await verifyExportDownloadCapability(opaque);
    if (!record) {
      res.status(403).json({
        error: 'EXPORT_DOWNLOAD_FORBIDDEN',
        message: 'Export download link is invalid or expired.'
      });
      return;
    }

    try {
      structuredLogger.info(
        {
          event: 'export_download_request',
          id: record.id,
          adapter_count: record.adapter_uris.length
        },
        'GET /export/skill-zip'
      );
      await runWithSpaceContextAsync(record.space_context, () =>
        streamSkillZipHttpResponse(res, memoryStore, qdrantService, record.adapter_uris)
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      structuredLogger.error('export download failed', error);
      if (res.headersSent) {
        res.end();
        return;
      }
      res.status(500).json({ error: 'EXPORT_DOWNLOAD_FAILED', message });
    }
  });
}
