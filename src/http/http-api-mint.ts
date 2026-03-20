import getRawBody from 'raw-body';
import express from 'express';
import { kairosMintSimilarMemoryFound } from '../services/metrics/mcp-metrics.js';
import { MemoryQdrantStore } from '../services/memory/store.js';
import { structuredLogger } from '../utils/structured-logger.js';
import { executeMint, MintError } from '../tools/kairos_mint.js';
import { mintInputSchema } from '../tools/kairos_mint_schema.js';
import { HTTP_MINT_RAW_BODY_LIMIT } from '../config.js';

/**
 * Set up API route for raw markdown ingestion.
 * Builds MintInput from raw body + query/headers and returns executeMint result only (no metadata).
 */
export function setupMintRoute(app: express.Express, memoryStore: MemoryQdrantStore) {
  app.post('/api/kairos_mint/raw', async (req, res) => {
    try {
      const contentLength = req.headers['content-length'] ? parseInt(req.headers['content-length'], 10) : null;
      const rawBody = await getRawBody(req, {
        limit: HTTP_MINT_RAW_BODY_LIMIT,
        encoding: 'utf8',
        ...(contentLength !== null && { length: contentLength })
      });
      const markdown = String(rawBody).trim();
      if (!markdown) {
        res.status(400).json({ error: 'INVALID_INPUT', message: 'Empty markdown content' });
        return;
      }

      const llm_model_id =
        (req.query['llm_model_id'] as string) ||
        (req.headers['x-llm-model-id'] as string) ||
        req.headers['user-agent'] ||
        'http-api';
      const force_update =
        req.query['force'] === 'true' || req.headers['x-force-update'] === 'true';
      const protocol_version = (req.query['protocol_version'] as string) || (req.headers['x-protocol-version'] as string) || undefined;

      const bodyInput = { markdown_doc: markdown, llm_model_id, force_update, ...(protocol_version && { protocol_version }) };
      const parsed = mintInputSchema.safeParse(bodyInput);
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

      structuredLogger.info(`→ POST /api/kairos_mint/raw (${markdown.length} bytes, model: ${parsed.data.llm_model_id}, force: ${parsed.data.force_update})`);
      const result = await executeMint(memoryStore, parsed.data, (fn) => fn());
      res.status(200).json(result);
    } catch (error) {
      const err = error as { code?: string; details?: Record<string, unknown>; message?: string; status?: number; statusCode?: number; type?: string };
      if (err?.status === 413 || err?.statusCode === 413 || err?.type === 'entity.too.large') {
        res.status(413).json({
          error: 'PAYLOAD_TOO_LARGE',
          message: 'Request body exceeds the configured size limit'
        });
        return;
      }
      if (error instanceof MintError) {
        res.status(400).json({
          error: error.code,
          message: error.message,
          ...error.details
        });
        return;
      }
      if (err?.code === 'DUPLICATE_CHAIN' || err?.code === 'DUPLICATE_KEY') {
        structuredLogger.warn(`✗ Duplicate chain: ${err.message}`);
        res.status(409).json({
          error: 'DUPLICATE_CHAIN',
          message: 'Memory chain with this label already exists. Use --force flag to overwrite.',
          ...(err.details || {})
        });
        return;
      }
      if (err?.code === 'SIMILAR_MEMORY_FOUND') {
        kairosMintSimilarMemoryFound.inc({ transport: 'http', tenant_id: 'http' });
        structuredLogger.warn(`✗ Similar memory found: ${err.message}`);
        const d = err.details || {};
        res.status(409).json({
          error: 'SIMILAR_MEMORY_FOUND',
          existing_memory: (d as any).existing_memory,
          similarity_score: (d as any).similarity_score,
          message: (d as any).message ?? 'A very similar memory already exists by title. Verify it before overwriting.',
          must_obey: (d as any).must_obey ?? true,
          next_action: (d as any).next_action,
          ...((d as any).content_preview !== undefined && { content_preview: (d as any).content_preview })
        });
        return;
      }
      structuredLogger.error('✗ Store failed', error);
      res.status(500).json({
        error: 'STORE_FAILED',
        message: err?.message ?? 'Failed to store markdown'
      });
    }
  });
}
