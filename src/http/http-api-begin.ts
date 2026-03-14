import express from 'express';
import { MemoryQdrantStore } from '../services/memory/store.js';
import { structuredLogger } from '../utils/structured-logger.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { redisCacheService } from '../services/redis-cache.js';
import { executeSearch } from '../services/kairos-orchestration.js';

/**
 * Set up API route for kairos_search (V2 unified response).
 * Uses shared executeSearch so behavior matches MCP (including weak single-match → refine/create).
 */
export function setupBeginRoute(app: express.Express, memoryStore: MemoryQdrantStore, qdrantService: QdrantService): void {
  app.post('/api/kairos_search', async (req, res) => {
    const startTime = Date.now();

    try {
      const { query } = req.body;

      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        res.status(400).json({
          error: 'INVALID_INPUT',
          message: 'query is required and must be a non-empty string'
        });
        return;
      }

      structuredLogger.info(`-> POST /api/kairos_search (query: ${query})`);

      const normalizedQuery = query.trim().toLowerCase();
      const parseEnvBool = (name: string, defaultVal: boolean) => {
        const v = process.env[name];
        if (v === undefined) return defaultVal;
        const low = String(v).toLowerCase();
        return !(low === 'false' || low === '0' || low === 'no' || low === 'n');
      };
      const enableGroupCollapse = parseEnvBool('KAIROS_ENABLE_GROUP_COLLAPSE', true);
      const cacheKey = `begin:v3:${normalizedQuery}:${enableGroupCollapse}`;

      const cachedResult = await redisCacheService.get(cacheKey);
      if (cachedResult) {
        const parsed = JSON.parse(cachedResult);
        const duration = Date.now() - startTime;
        return res.status(200).json({
          ...parsed,
          metadata: { cached: true, duration_ms: duration }
        });
      }

      const output = await executeSearch(memoryStore, query, {
        qdrantService,
        enableGroupCollapse
      });

      await redisCacheService.set(cacheKey, JSON.stringify(output), 300);

      const duration = Date.now() - startTime;
      structuredLogger.info(`kairos_search completed in ${duration}ms`);

      res.status(200).json({
        ...output,
        metadata: { duration_ms: duration }
      });
      return;
    } catch (error) {
      const duration = Date.now() - startTime;
      structuredLogger.error(`kairos_search failed in ${duration}ms`, error);
      res.status(500).json({
        error: 'SEARCH_FAILED',
        message: error instanceof Error ? error.message : 'Failed to search for chain heads',
        duration_ms: duration
      });
      return;
    }
  });
}
