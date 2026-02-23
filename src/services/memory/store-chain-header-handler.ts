import type { Memory } from '../../types/memory.js';
import { QdrantClient } from '@qdrant/js-client-rest';
import { logger } from '../../utils/logger.js';
import { embeddingService } from '../embedding/service.js';
import { getEmbeddingDimension } from '../../config.js';
import { IDGenerator } from '../id-generator.js';
import { modelStats } from '../stats/model-stats.js';
import { redisCacheService } from '../redis-cache.js';
import { memoryStore, memoryChainSize } from '../metrics/memory-metrics.js';
import { getTenantId, getSpaceContext } from '../../utils/tenant-context.js';
import { deriveDomainTaskType, handleDuplicateChain } from './store-chain-helpers.js';
import type { MemoryQdrantStoreMethods } from './store-methods.js';

/**
 * Handles header-based chain storage (H1/H2 sections)
 */
export async function storeHeaderBasedChain(
  client: QdrantClient,
  collection: string,
  methods: MemoryQdrantStoreMethods,
  headerChainMemories: Memory[],
  llmModelId: string,
  forceUpdate: boolean
): Promise<Memory[]> {
  const tenantId = getTenantId();

  // Determine chain label and deterministic v5 chain UUID
  const firstLabel = headerChainMemories[0]?.label || 'Knowledge Chain';
  const explicitChainLabel = headerChainMemories[0]?.chain?.label;
  const chainLabel = (explicitChainLabel && explicitChainLabel.trim().length > 0)
    ? explicitChainLabel.trim()
    : (firstLabel.includes(':') ? firstLabel.split(':')[0]!.trim() : firstLabel.trim());
  const chainUuid = IDGenerator.generateChainUUIDv5(chainLabel);

  // Handle duplicate chain
  await handleDuplicateChain(client, collection, chainUuid, forceUpdate);

  // Generate embeddings for each H2 section
  const sectionTexts = headerChainMemories.map(m => m.text);
  const vectorSize = getEmbeddingDimension();
  const currentVectorName = `vs${vectorSize}`;
  let vectors: number[][];
  try {
    const batch = await embeddingService.generateBatchEmbeddings(sectionTexts);
    vectors = batch.embeddings;
    const wrongCount = vectors.length !== headerChainMemories.length;
    const wrongDim = vectors.some(v => !Array.isArray(v) || v.length !== vectorSize);
    if (wrongCount || wrongDim) {
      logger.warn(
        `[MemoryQdrantStore] Embedding shape mismatch for header-based chain (count=${vectors.length}/${headerChainMemories.length}, dimOK=${!wrongDim}). Falling back to zero vectors.`
      );
      vectors = headerChainMemories.map(() => Array(vectorSize).fill(0));
    }
  } catch (err) {
    logger.error('[MemoryQdrantStore] Failed to generate embeddings for header-based chain; falling back to zero vectors', err);
    vectors = headerChainMemories.map(() => Array(vectorSize).fill(0));
  }

  const chainStepCount = headerChainMemories.length;
  const spaceId = getSpaceContext().defaultWriteSpaceId;

  const points = headerChainMemories.map((memory, i) => {
    const dtt = deriveDomainTaskType(memory.label, memory.text, memory.tags);
    const qualityMetadata = modelStats.calculateStepQualityMetadata(
      memory.label,
      'general',
      dtt.task,
      dtt.type,
      memory.tags
    );
    return ({
      id: memory.memory_uuid,
      vector: { [currentVectorName]: vectors[i]! },
      payload: {
        space_id: spaceId,
        label: memory.label,
        tags: memory.tags,
        text: memory.text,
        llm_model_id: memory.llm_model_id,
        created_at: memory.created_at,
        proof_of_work: memory.proof_of_work,
        task: dtt.task,
        type: dtt.type,
        quality_metadata: {
          step_quality_score: qualityMetadata.step_quality_score,
          step_quality: qualityMetadata.step_quality
        },
        chain: {
          id: chainUuid,
          label: chainLabel,
          step_index: i + 1,
          step_count: chainStepCount
        }
      }
    });
  });

  logger.tool(
    'memory-qdrant-store',
    'upsert',
    `mode=h1-h2 sections=${headerChainMemories.length} collection=${collection} payload=${JSON.stringify({
      points
    })}`
  );

  logger.debug(`[Qdrant][upsert] collection=${collection} points=${points.length}`);
  await client.upsert(collection, { points });

  // Publish cache invalidation
  await redisCacheService.invalidateAfterUpdate();
  methods.invalidateLocalCache();

  // Update model statistics for each stored step
  for (const memory of headerChainMemories) {
    try {
      const { task, type } = deriveDomainTaskType(memory.label, memory.text, memory.tags);
      const score = modelStats.calculateQualityScore(memory.label, task, type, memory.tags);
      await modelStats.processContribution(memory.llm_model_id, score, memory.label);
      
      const quality = score.quality;
      memoryStore.inc({ quality, tenant_id: tenantId });
      
      if (memory.chain) {
        memoryChainSize.observe({ tenant_id: tenantId }, memory.chain.step_count);
      }
    } catch { }
  }

  return headerChainMemories;
}

