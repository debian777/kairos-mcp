import express from 'express';
import { MemoryQdrantStore } from '../services/memory/store.js';
import { structuredLogger } from '../utils/structured-logger.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { runWithOptionalSpaceAsync } from '../utils/tenant-context.js';
import { executeSearch, executeBegin, selectRunTarget } from '../services/kairos-orchestration.js';

/**
 * Set up API route for kairos_run (canonical natural-language start).
 * Same behavior as MCP kairos_run: search then begin one strong match or refine.
 */
export function setupRunRoute(
  app: express.Express,
  memoryStore: MemoryQdrantStore,
  qdrantService: QdrantService
): void {
  app.post('/api/kairos_run', async (req, res) => {
    const startTime = Date.now();

    try {
      const { message, space, space_id } = req.body ?? {};
      const spaceParam = space ?? space_id;

      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        res.status(400).json({
          error: 'INVALID_INPUT',
          message: 'message is required and must be a non-empty string'
        });
        return;
      }

      structuredLogger.info(`-> POST /api/kairos_run (message: ${message.slice(0, 60)}...)`);

      const parseEnvBool = (name: string, defaultVal: boolean) => {
        const v = process.env[name];
        if (v === undefined) return defaultVal;
        const low = String(v).toLowerCase();
        return !(low === 'false' || low === '0' || low === 'no' || low === 'n');
      };
      const enableGroupCollapse = parseEnvBool('KAIROS_ENABLE_GROUP_COLLAPSE', true);

      const output = await runWithOptionalSpaceAsync(spaceParam, async () => {
        const searchOutput = await executeSearch(memoryStore, message, {
          qdrantService,
          enableGroupCollapse
        });
        const { uri: selectedUri, choice: selectedChoice, decision } = selectRunTarget(searchOutput.choices);
        const beginPayload = await executeBegin(memoryStore, selectedUri, { qdrantService });
        return {
          ...beginPayload,
          routing: {
            decision,
            selected_uri: selectedChoice.uri,
            selected_label: selectedChoice.label,
            selected_role: selectedChoice.role,
            selected_score: selectedChoice.score ?? null,
            protocol_version: selectedChoice.protocol_version ?? null
          }
        };
      });

      const duration = Date.now() - startTime;
      structuredLogger.info(`kairos_run completed in ${duration}ms`);

      res.status(200).json({
        ...output,
        metadata: { duration_ms: duration }
      });
      return;
    } catch (error) {
      const duration = Date.now() - startTime;
      if (error instanceof Error && error.message === 'Requested space is not in your allowed spaces') {
        res.status(403).json({
          error: 'forbidden',
          message: error.message,
          duration_ms: duration
        });
        return;
      }
      structuredLogger.error(`kairos_run failed in ${duration}ms`, error);
      res.status(500).json({
        error: 'RUN_FAILED',
        message: error instanceof Error ? error.message : 'Failed to run from message',
        duration_ms: duration
      });
      return;
    }
  });
}
