import type { QdrantConnection } from './connection.js';
import { getSpaceContext } from '../../utils/tenant-context.js';
import { buildSpaceFilter } from '../../utils/space-filter.js';
import { updateQualityMetrics } from './quality.js';
import { logger } from '../../utils/structured-logger.js';
import { redisCacheService } from '../redis-cache.js';
import { retrieveAccessiblePointById } from './memory-retrieval.js';

/**
 * Resolve the adapter head from a completion layer and propagate reward
 * quality metrics so activation ranking can see the final outcome.
 */
export async function propagateRewardToAdapterHead(
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

    const adapterId = (payload['adapter'] as { id?: string } | undefined)?.id;
    if (!adapterId || typeof adapterId !== 'string') {
      logger.debug(`[reward-propagation] Step ${stepPointId} has no adapter.id, skip propagation`);
      return null;
    }

    const layerIndex = (payload['adapter'] as { layer_index?: number } | undefined)?.layer_index;
    if (layerIndex === 1) {
      logger.debug(`[reward-propagation] Step ${stepPointId} is already the adapter head, skip propagation`);
      return null;
    }

    const filter = buildSpaceFilter(getSpaceContext().allowedSpaceIds, {
      must: [
        { key: 'adapter.id', match: { value: adapterId } },
        { key: 'adapter.layer_index', match: { value: 1 } }
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
      logger.warn(`[reward-propagation] Adapter head not found for adapter ${adapterId}, skip propagation`);
      return null;
    }

    const adapterHeadId = String((points[0] as { id: string | number }).id);
    await updateQualityMetrics(conn, adapterHeadId, metricsUpdate);
    try {
      await redisCacheService.invalidateBeginCache();
    } catch (cacheErr) {
      logger.warn(
        `[reward-propagation] Cache invalidation failed after adapter head update (adapterHeadId=${adapterHeadId}); reward succeeded: ${cacheErr instanceof Error ? cacheErr.message : String(cacheErr)}`
      );
    }
    logger.info(`[reward-propagation] Updated adapter head ${adapterHeadId} for adapter ${adapterId}`);
    return adapterHeadId;
  });
}
