import type { Memory } from '../../types/memory.js';
import { QdrantClient } from '@qdrant/js-client-rest';
import { logger } from '../../utils/structured-logger.js';
import { embeddingService } from '../embedding/service.js';
import { getEmbeddingDimension } from '../embedding/config.js';
import { bm25Tokenizer } from '../embedding/bm25-tokenizer.js';
import { IDGenerator } from '../id-generator.js';
import { modelStats } from '../stats/model-stats.js';
import { redisCacheService } from '../redis-cache.js';
import { memoryStore, memoryChainSize } from '../metrics/memory-metrics.js';
import { getTenantId, getSpaceContext } from '../../utils/tenant-context.js';
import {
  getActivationPatternVectorName,
  getAdapterTitleVectorName,
  getPrimaryVectorName
} from '../../utils/qdrant-vector-types.js';
import {
  allocateProtocolSlugForMint,
  deriveDomainTaskType,
  handleDuplicateChain,
  type ProtocolSlugMintInput
} from './store-chain-helpers.js';
import type { MemoryQdrantStoreMethods } from './store-methods.js';
import { buildActivationSearchFieldsForMemory } from './activation-search-fields.js';

/**
 * Handles header-based chain storage (H1/H2 sections)
 */
export async function storeHeaderBasedChain(
  client: QdrantClient,
  collection: string,
  methods: MemoryQdrantStoreMethods,
  headerChainMemories: Memory[],
  llmModelId: string,
  forceUpdate: boolean,
  slugInput: ProtocolSlugMintInput
): Promise<Memory[]> {
  const tenantId = getTenantId();

  // Determine chain label and deterministic v5 chain UUID
  const firstLabel = headerChainMemories[0]?.label || 'Knowledge Chain';
  const explicitChainLabel = headerChainMemories[0]?.adapter?.name ?? headerChainMemories[0]?.chain?.label;
  const chainLabel = (explicitChainLabel && explicitChainLabel.trim().length > 0)
    ? explicitChainLabel.trim()
    : (firstLabel.includes(':') ? firstLabel.split(':')[0]!.trim() : firstLabel.trim());
  const chainUuid = IDGenerator.generateChainUUIDv5(chainLabel);

  // Handle duplicate chain
  await handleDuplicateChain(client, collection, chainUuid, forceUpdate);

  const protocolSlug = await allocateProtocolSlugForMint(client, collection, slugInput, chainUuid);

  const vectorSize = getEmbeddingDimension();
  const primaryVectorName = getPrimaryVectorName(vectorSize);
  const titleVectorName = getAdapterTitleVectorName(vectorSize);
  const activationPatternVectorName = getActivationPatternVectorName(vectorSize);
  const activationFields = headerChainMemories.map((memory) => buildActivationSearchFieldsForMemory(memory));
  let primaryVectors: number[][];
  let titleVectors: number[][];
  let activationPatternVectors: number[][];
  try {
    const batch = await embeddingService.generateBatchEmbeddings(
      activationFields.flatMap((fields) => [
        fields.primaryDenseText,
        fields.titleDenseText,
        fields.activationPatternDenseText
      ])
    );
    const embeddings = batch.embeddings;
    const wrongCount = embeddings.length !== headerChainMemories.length * 3;
    const wrongDim = embeddings.some(v => !Array.isArray(v) || v.length !== vectorSize);
    if (wrongCount || wrongDim) {
      logger.warn(
        `[MemoryQdrantStore] Embedding shape mismatch for header-based chain (count=${embeddings.length}/${headerChainMemories.length * 3}, dimOK=${!wrongDim}). Falling back to zero vectors.`
      );
      primaryVectors = headerChainMemories.map(() => Array(vectorSize).fill(0));
      titleVectors = headerChainMemories.map(() => Array(vectorSize).fill(0));
      activationPatternVectors = headerChainMemories.map(() => Array(vectorSize).fill(0));
    } else {
      primaryVectors = headerChainMemories.map((_, index) => embeddings[index * 3]!);
      titleVectors = headerChainMemories.map((_, index) => embeddings[index * 3 + 1]!);
      activationPatternVectors = headerChainMemories.map((_, index) => embeddings[index * 3 + 2]!);
    }
  } catch (err) {
    logger.error('[MemoryQdrantStore] Failed to generate embeddings for header-based chain; falling back to zero vectors', err);
    primaryVectors = headerChainMemories.map(() => Array(vectorSize).fill(0));
    titleVectors = headerChainMemories.map(() => Array(vectorSize).fill(0));
    activationPatternVectors = headerChainMemories.map(() => Array(vectorSize).fill(0));
  }

  const chainStepCount = headerChainMemories.length;
  const context = getSpaceContext();
  const spaceId = context.defaultWriteSpaceId;
  const actorId = context.userId || 'system';

  const points = headerChainMemories.map((memory, i) => {
    const dtt = deriveDomainTaskType(memory.label, memory.text, memory.tags);
    const qualityMetadata = modelStats.calculateStepQualityMetadata(
      memory.label,
      'general',
      dtt.task,
      dtt.type,
      memory.tags
    );
    const fields = activationFields[i]!;
    const sparse = bm25Tokenizer.tokenize(fields.sparseText);
    const adapter = memory.adapter ?? {
      id: chainUuid,
      name: chainLabel,
      layer_index: i + 1,
      layer_count: chainStepCount,
      ...(memory.chain?.protocol_version && { protocol_version: memory.chain.protocol_version }),
      ...(memory.activation_patterns && { activation_patterns: memory.activation_patterns })
    };
    const inferenceContract = memory.inference_contract ?? memory.proof_of_work;
    return ({
      id: memory.memory_uuid,
      vector: {
        [primaryVectorName]: primaryVectors[i]!,
        [titleVectorName]: titleVectors[i]!,
        [activationPatternVectorName]: activationPatternVectors[i]!,
        bm25: { indices: sparse.indices, values: sparse.values }
      },
      payload: {
        space_id: spaceId,
        label: memory.label,
        tags: memory.tags,
        text: memory.text,
        llm_model_id: memory.llm_model_id,
        created_at: memory.created_at,
        created_by: actorId,
        modified_at: memory.created_at,
        modified_by: actorId,
        activation_patterns: memory.activation_patterns ?? adapter.activation_patterns ?? [],
        adapter_name_text: fields.adapterNameText,
        label_text: fields.labelText,
        activation_patterns_text: fields.activationPatternsText,
        tags_text: fields.tagsText,
        inference_contract: inferenceContract,
        proof_of_work: inferenceContract,
        task: dtt.task,
        type: dtt.type,
        quality_metadata: {
          step_quality_score: qualityMetadata.step_quality_score,
          step_quality: qualityMetadata.step_quality
        },
        adapter: {
          id: chainUuid,
          name: chainLabel,
          layer_index: i + 1,
          layer_count: chainStepCount,
          ...(adapter.protocol_version && { protocol_version: adapter.protocol_version }),
          ...(adapter.activation_patterns && { activation_patterns: adapter.activation_patterns })
        },
        chain: {
          id: chainUuid,
          label: chainLabel,
          step_index: i + 1,
          step_count: chainStepCount,
          ...(memory.chain?.protocol_version && { protocol_version: memory.chain.protocol_version })
        },
        slug: protocolSlug
      }
    });
  });

  logger.tool(
    'memory-qdrant-store',
    'upsert',
    `mode=h1-h2 sections=${headerChainMemories.length} collection=${collection} points=${points.length}`
  );
  logger.debug(
    `[Qdrant][upsert] collection=${collection} points=${points.length} payload=${JSON.stringify({ points })}`
  );
  try {
    await client.upsert(collection, { points });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Bad Request') || msg.includes('sparse') || msg.includes('vector')) {
      const pointsDenseOnly = points.map(p => ({
        ...p,
        vector: Object.fromEntries(
          Object.entries(p.vector as Record<string, unknown>).filter(([name]) => name !== 'bm25')
        )
      }));
      logger.warn(`[Qdrant][upsert] retrying without bm25 (collection may lack sparse config): ${msg}`);
      await client.upsert(collection, { points: pointsDenseOnly } as any);
    } else {
      throw err;
    }
  }

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
      
      if (memory.adapter) {
        memoryChainSize.observe({ tenant_id: tenantId }, memory.adapter.layer_count);
      } else if (memory.chain) {
        memoryChainSize.observe({ tenant_id: tenantId }, memory.chain.step_count);
      }
    } catch { }
  }

  return headerChainMemories;
}

