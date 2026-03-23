import express from 'express';
import { structuredLogger } from '../utils/structured-logger.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { rewardInputSchema } from '../tools/reward_schema.js';
import { executeReward } from '../tools/reward.js';

/**
 * Set up API route for reward.
 */
export function setupRewardRoute(app: express.Express, qdrantService: QdrantService) {
  app.post('/api/reward', async (req, res) => {
    try {
      const parsed = rewardInputSchema.safeParse(req.body);
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

      structuredLogger.info(`-> POST /api/reward (uri: ${parsed.data.uri}, outcome: ${parsed.data.outcome})`);
      const result = await executeReward(qdrantService, parsed.data);
      res.status(200).json(result);
    } catch (error) {
      structuredLogger.error('reward failed', error);
      res.status(500).json({
        error: 'REWARD_FAILED',
        message: error instanceof Error ? error.message : 'Failed to record reward'
      });
    }
  });
}
