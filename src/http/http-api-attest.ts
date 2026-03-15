import express from 'express';
import { structuredLogger } from '../utils/structured-logger.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { attestInputSchema } from '../tools/kairos_attest_schema.js';
import { executeAttest } from '../tools/kairos_attest.js';

/**
 * Set up API route for kairos_attest (V2: no final_solution required).
 * Validates with canonical schema and returns executeAttest result only (no metadata).
 */
export function setupAttestRoute(app: express.Express, qdrantService: QdrantService) {
  app.post('/api/kairos_attest', async (req, res) => {
    try {
      const parsed = attestInputSchema.safeParse(req.body);
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

      structuredLogger.info(`-> POST /api/kairos_attest (uri: ${parsed.data.uri}, outcome: ${parsed.data.outcome})`);
      const result = await executeAttest(qdrantService, parsed.data);
      res.status(200).json(result);
    } catch (error) {
      structuredLogger.error('kairos_attest failed', error);
      res.status(500).json({
        error: 'ATTEST_FAILED',
        message: error instanceof Error ? error.message : 'Failed to attest step completion'
      });
    }
  });
}
