import type { QdrantConnection } from './connection.js';
import { getSpaceContext } from '../../utils/tenant-context.js';
import { buildSpaceFilter } from '../../utils/space-filter.js';
import { updateQualityMetrics } from './quality.js';
import { logger } from '../../utils/structured-logger.js';
import { redisCacheService } from '../redis-cache.js';
import { retrieveAccessiblePointById } from './memory-retrieval.js';

/**
 * Resolve the chain head from a completion layer and propagate reward
 * quality metrics so activation ranking can see the final outcome.
 */
export async function propagateRewardToChainHead(
  conn: QdrantConnection,
  stepPointId: string,
  metricsUpdate: Record<string, unknown>
): Promise<string | null> {
  return conn.executeWithReconnect(async () => {
    const stepPoint = await retrieveAccessiblePointById(conn, stepPointId);
    if (!stepPoint) {
      logger.debug(`[reward-propagation] Step ${stepPointId} not found, skip propagation`);
      return null;
    }

    const payload = stepPoint.payload as Record<string, unknown> | undefined;
    if (!payload) {
      logger.debug(`[reward-propagation] Step ${stepPointId} has no payload, skip propagation`);
      return null;
    }

    const chainId =
      (payload['chain'] as { id?: string } | undefined)?.id ??
      (payload['memory_chain_id'] as string | undefined);
    if (!chainId || typeof chainId !== 'string') {
      logger.debug(`[reward-propagation] Step ${stepPointId} has no chain.id, skip propagation`);
      return null;
    }

    const stepIndex =
      (payload['chain'] as { step_index?: number } | undefined)?.step_index ??
      (payload['chain_step_index'] as number | undefined);
    if (stepIndex === 1) {
      logger.debug(`[reward-propagation] Step ${stepPointId} is already the chain head, skip propagation`);
      return null;
    }

    const filter = buildSpaceFilter(getSpaceContext().allowedSpaceIds, {
      must: [
        { key: 'chain.id', match: { value: chainId } },
        { key: 'chain.step_index', match: { value: 1 } }
      ]
    });

    const scrollResult = await conn.client.scroll(conn.collectionName, {
      filter,
      limit: 1,
      with_payload: false,
      with_vector: false
    } as Parameters<typeof conn.client.scroll>[1]);

    const points = scrollResult?.points ?? [];
    if (points.length === 0) {
      logger.warn(`[reward-propagation] Chain head not found for chain ${chainId}, skip propagation`);
      return null;
    }

    const chainHeadId = String((points[0] as { id: string | number }).id);
    await updateQualityMetrics(conn, chainHeadId, metricsUpdate);
    try {
      await redisCacheService.invalidateBeginCache();
    } catch (cacheErr) {
      logger.warn(
        `[reward-propagation] Cache invalidation failed after chain head update (chainHeadId=${chainHeadId}); reward succeeded: ${cacheErr instanceof Error ? cacheErr.message : String(cacheErr)}`
      );
    }
    logger.info(`[reward-propagation] Updated chain head ${chainHeadId} for chain ${chainId}`);
    return chainHeadId;
  });
}
