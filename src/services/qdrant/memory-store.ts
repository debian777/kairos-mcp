import { QdrantConnection } from './connection.js';
import { buildDomainTypeTaskURI, buildProtocolStepURI } from '../../utils/uri-builder.js';
import { IDGenerator } from '../id-generator.js';
import { sanitizeAndUpsert } from './utils.js';
import { logger } from '../../utils/logger.js';
import { redisCacheService } from '../redis-cache.js';
import { qdrantOperations, qdrantUpsertDuration } from '../metrics/qdrant-metrics.js';
import { getTenantId } from '../../utils/tenant-context.js';

/**
 * storeMemory - stores a single memory point in Qdrant
 * @param uuid - Optional UUID to use as qdrantId. If provided, URI generation is skipped and this UUID is used directly.
 */
export async function storeMemory(
  conn: QdrantConnection,
  description_short: string,
  description_full: string,
  domain: string,
  task: string,
  type: string = 'context',
  tags: string[] = [],
  embedding: number[] = [],
  protocol?: { step: number; total: number; enforcement: 'sequential' | 'flexible'; skip_allowed: boolean; title?: string; memory_uuid?: string },
  uuid?: string
): Promise<{ qdrantId: string }> {
  return conn.executeWithReconnect(async () => {
    const tenantId = getTenantId();
    const timer = qdrantUpsertDuration.startTimer({ tenant_id: tenantId });
    
    try {
    let qdrantId: string;
    let humanUri: string | undefined;

    if (uuid) {
      // Use provided UUID directly
      qdrantId = uuid;
      logger.info(`storeMemory: Using provided UUID as qdrantId: ${qdrantId}`);
    } else {
      // Generate URI and Qdrant ID as before
      if (protocol && protocol.step) {
        humanUri = buildProtocolStepURI(domain, type, task, protocol.step);
        logger.info(`storeMemory: Built protocol URI for step ${protocol.step}: ${humanUri}`);
      } else {
        humanUri = buildDomainTypeTaskURI(domain, type, task);
        logger.info(`storeMemory: Built non-protocol URI: ${humanUri}`);
      }
      qdrantId = IDGenerator.buildQdrantId(humanUri);
      logger.info(`storeMemory: Generated Qdrant ID from URI: ${qdrantId} (from ${humanUri})`);
    }

    let aiWithContext: { model_id: string; memory_uuid?: string } = { model_id: 'unknown' };
    if (protocol) {
      aiWithContext = { model_id: 'unknown', memory_uuid: qdrantId };
    }

    const point = {
      id: qdrantId,
      vector: { [`vs${embedding.length}`]: embedding },
      payload: {
        description_short,
        description_full,
        domain,
        task,
        type,
        tags,
        ai: aiWithContext,
        protocol: protocol,
        quality_metrics: {
          retrievalCount: 0,
          successCount: 0,
          partialCount: 0,
          failureCount: 0,
          lastRated: null,
          lastRater: null,
          qualityBonus: 0,
          usageContext: null,
          implementation_stats: {
            total_attempts: 0,
            success_attempts: 0,
            model_success_rates: {},
            confidence_level: 0,
            last_implementation_attempt: null
          },
          healer_contributions: {
            total_healers: 0,
            total_improvements: 0,
            healer_gems_distributed: 0,
            last_healed: null,
            healer_models: {}
          },
          step_success_rates: {}
        },
        created_at: new Date().toISOString()
      }
    };

    logger.info(`storeMemory: About to upsert point with qdrantId: ${qdrantId}, humanUri: ${humanUri}`);
    const upsertResult = await sanitizeAndUpsert(conn.client, conn.collectionName, [point]);
    logger.info(`storeMemory: Upsert result for qdrantId ${qdrantId}: ${JSON.stringify(upsertResult)}`);
    
    // Invalidate cache after creation
    await redisCacheService.invalidateMemoryCache(qdrantId);
    await redisCacheService.invalidateSearchCache();
    // Publish invalidation event via pub/sub
    await redisCacheService.publishInvalidation('memory');
    await redisCacheService.publishInvalidation('search');
    
    qdrantOperations.inc({ 
      operation: 'upsert', 
      status: 'success',
      tenant_id: tenantId 
    });
    
    timer({ tenant_id: tenantId });
    
    return { qdrantId };
    } catch (error) {
      qdrantOperations.inc({ 
        operation: 'upsert', 
        status: 'error',
        tenant_id: tenantId 
      });
      timer({ tenant_id: tenantId });
      throw error;
    }
  });
}