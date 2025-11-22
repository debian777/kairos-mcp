import { QdrantConnection } from './connection.js';
import { UpsertResourceItem, UpsertResourceResult } from './types.js';
import { embeddingService } from '../embedding/service.js';
import { IDGenerator } from '../id-generator.js';
import { buildDomainTypeTaskURI, buildProtocolStepURI } from '../../utils/uri-builder.js';
import { sanitizeAndUpsert, validatePayload, validateAndConvertId } from './utils.js';
import { redisCacheService } from '../redis-cache.js';
import { logger } from '../../utils/logger.js';
import { getEmbeddingDimension } from '../../config.js';

/**
 * upsertResources - bulk upsert of knowledge resources
 */
export async function upsertResources(conn: QdrantConnection, items: UpsertResourceItem[]): Promise<UpsertResourceResult[]> {
  return conn.executeWithReconnect(async () => {
    logger.info(`DEBUG: upsertResources called with ${items.length} items`);
    const results: UpsertResourceResult[] = [];

    for (const item of items) {
      const uuid = item.uuid ? validateAndConvertId(item.uuid) : IDGenerator.generateUUID();

      // Duplicate check simplified: reuse scroll
      const existingDuplicate = await conn.client.scroll(conn.collectionName, {
        filter: {
          must: [
            { key: 'domain', match: { value: item.domain } },
            { key: 'type', match: { value: item.type || 'context' } },
            { key: 'task', match: { value: item.task } },
            ...(item.protocol ? [{ key: 'protocol.step', match: { value: item.protocol.step } }] : [])
          ]
        },
        limit: 1,
        with_payload: true,
        with_vector: false
      });
      if (existingDuplicate.points && existingDuplicate.points.length > 0) {
        const point = existingDuplicate.points[0]!;
        const compositeKey = item.protocol ? `${item.domain}/${item.type || 'context'}/${item.task}/step/${item.protocol.step}` : `${item.domain}/${item.type || 'context'}/${item.task}`;
        throw new Error(`DUPLICATE_KEY: Composite key ${compositeKey} already exists with ID ${point.id}`);
      }

      const kbUri = item.protocol && item.protocol.step
        ? buildProtocolStepURI(item.domain, item.type || 'context', item.task, item.protocol.step)
        : buildDomainTypeTaskURI(item.domain, item.type || 'context', item.task);

      const qdrantId = IDGenerator.buildQdrantId(kbUri);

      logger.info(`DEBUG: Generating embedding for item ${item.description_short}`);
      const embeddingResult = await embeddingService.generateEmbedding(item.description_full);
      let embedding = embeddingResult.embedding;
      if (!Array.isArray(embedding) || embedding.length === 0) {
        const vectorSize = getEmbeddingDimension();
        logger.warn(`upsertResources: embedding service returned empty vector for item ${item.description_short}. Falling back to zero vector of size ${vectorSize}`);
        embedding = Array(vectorSize).fill(0);
      }

      const existingPoint = await conn.client.retrieve(conn.collectionName, { ids: [uuid], with_payload: true, with_vector: false });
      const isUpdate = Array.isArray(existingPoint) && existingPoint.length > 0;
      const version = isUpdate ? ((existingPoint[0]!.payload?.['version'] as number) || 1) + 1 : 1;

      let protocolWithContext = item.protocol;
      let aiWithContext = item.ai;
      if (item.protocol) {
        const stepUuid = qdrantId;
        protocolWithContext = { ...item.protocol };
        aiWithContext = { ...item.ai, memory_uuid: stepUuid };
      }

      const payload = {
        uuid,
        description_short: item.description_short,
        description_full: item.description_full,
        domain: item.domain,
        task: item.task,
        type: item.type || 'context',
        tags: item.tags || [],
        protocol: protocolWithContext,
        ai: aiWithContext,
        uri: kbUri,
        version,
        created_at: isUpdate ? existingPoint[0]!.payload?.['created_at'] : new Date().toISOString(),
        updated_at: new Date().toISOString(),
        gem_metadata: item.gem_metadata || {
          step_gem_potential: 1,
          step_quality: 'quality',
          workflow_total_potential: 0,
          workflow_quality: '',
          motivational_text: 'This knowledge pattern contributes to your learning journey.'
        },
        quality_metrics: isUpdate ? existingPoint[0]!.payload?.['quality_metrics'] : {
          retrievalCount: 0, successCount: 0, partialCount: 0, failureCount: 0, lastRated: null, lastRater: null, qualityBonus: 0,
          usageContext: null, implementation_stats: { total_attempts: 0, success_attempts: 0, model_success_rates: {}, confidence_level: 0, last_implementation_attempt: null },
          healer_contributions: { total_healers: 0, total_improvements: 0, healer_gems_distributed: 0, last_healed: null, healer_models: {} },
          step_success_rates: {}
        }
      };

      validatePayload(payload);

      logger.info(`DEBUG: Upserting point with qdrantId: ${qdrantId}, uri: ${kbUri}`);
      const currentVectorName = `vs${embedding.length}`;
      await sanitizeAndUpsert(conn.client, conn.collectionName, [{ id: qdrantId, vector: { [currentVectorName]: embedding }, payload }]);
      logger.info(`DEBUG: Upsert successful for ${uuid}`);

      await redisCacheService.invalidateAfterUpdate();

      results.push({
        uri: kbUri,
        uuid,
        status: isUpdate ? 'updated' : 'created',
        version,
        protocol_id: protocolWithContext?.title,
        protocol_uuid: protocolWithContext ? IDGenerator.generateDeterministicProtocolId(item.domain, item.type || 'context', item.task) : undefined,
        memory_uuid: aiWithContext?.memory_uuid,
        gem_metadata: payload.gem_metadata
      });
    }

    return results;
  });
}