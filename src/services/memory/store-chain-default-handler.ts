import crypto from 'node:crypto';
import type { Memory } from '../../types/memory.js';
import { QdrantClient } from '@qdrant/js-client-rest';
import { logger } from '../../utils/logger.js';
import { embeddingService } from '../embedding/service.js';
import { getEmbeddingDimension } from '../../config.js';
import { IDGenerator } from '../id-generator.js';
import { generateLabel, generateTags } from '../../utils/memory-store-utils.js';
import { modelStats } from '../stats/model-stats.js';
import { redisCacheService } from '../redis-cache.js';
import { memoryStore, memoryChainSize } from '../metrics/memory-metrics.js';
import { getTenantId } from '../../utils/tenant-context.js';
import { deriveDomainTaskType, handleDuplicateChain } from './store-chain-helpers.js';
import type { CodeBlockProcessor } from '../code-block-processor.js';
import type { MemoryQdrantStoreMethods } from './store-methods.js';

/**
 * Handles default chain storage (one memory per document)
 */
export async function storeDefaultChain(
  client: QdrantClient,
  collection: string,
  methods: MemoryQdrantStoreMethods,
  codeBlockProcessor: CodeBlockProcessor,
  normalizedDocs: string[],
  llmModelId: string,
  now: Date,
  forceUpdate: boolean
): Promise<Memory[]> {
  const tenantId = getTenantId();

  const uuids = normalizedDocs.map(() => crypto.randomUUID());
  const processedDocs = normalizedDocs.map(text => {
    const codeResult = codeBlockProcessor.processMarkdown(text);
    const enhancedText = codeBlockProcessor.enhanceContentForSearch(text, codeResult);
    return { original: text, enhanced: enhancedText, codeResult };
  });

  if (processedDocs.length === 0) {
    return [];
  }

  // Derive chain label from first doc and compute chain UUID
  const firstGeneratedLabel = generateLabel(processedDocs[0]!.original);
  const chainUuid = IDGenerator.generateChainUUIDv5(firstGeneratedLabel);

  // Handle duplicate chain
  await handleDuplicateChain(client, collection, chainUuid, forceUpdate);

  let embeddings: any;
  try {
    embeddings = await embeddingService.generateBatchEmbeddings(processedDocs.map(p => p.enhanced));
  } catch (err) {
    logger.warn('[MemoryQdrantStore] Failed to generate embeddings for default path; falling back to zero vectors: ' + (err instanceof Error ? err.message : String(err)));
    const vectorSize = getEmbeddingDimension();
    embeddings = { embeddings: processedDocs.map(() => Array(vectorSize).fill(0)) } as any;
  }
  const currentVectorName = `vs${getEmbeddingDimension()}`;
  const memories: Memory[] = processedDocs.map((processed, index) => {
    const memory_uuid = uuids[index]!;
    const baseTags = generateTags(processed.original);
    const codeTags = processed.codeResult.allIdentifiers.slice(0, 5);
    const allTags = [...baseTags, ...codeTags];

    const stepLabel = generateLabel(processed.original);
    return {
      memory_uuid,
      label: stepLabel,
      tags: allTags,
      text: processed.enhanced,
      llm_model_id: llmModelId,
      created_at: now.toISOString(),
      chain: {
        id: chainUuid,
        label: firstGeneratedLabel,
        step_index: index + 1,
        step_count: normalizedDocs.length
      }
    };
  });

  const points = memories.map((memory, index) => {
    const { task, type } = deriveDomainTaskType(memory.label, memory.text, memory.tags);
    const qualityMetadata = modelStats.calculateStepQualityMetadata(
      memory.label,
      'general',
      task,
      type,
      memory.tags
    );
    return ({
      id: memory.memory_uuid,
      vector: { [currentVectorName]: embeddings.embeddings[index]! },
      payload: {
        label: memory.label,
        tags: memory.tags,
        text: memory.text,
        llm_model_id: memory.llm_model_id,
        created_at: memory.created_at,
        proof_of_work: memory.proof_of_work,
        task,
        type,
        quality_metadata: {
          step_quality_score: qualityMetadata.step_quality_score,
          step_quality: qualityMetadata.step_quality
        },
        chain: {
          id: memory.chain!.id,
          label: memory.chain!.label,
          step_index: memory.chain!.step_index,
          step_count: memory.chain!.step_count
        }
      }
    });
  });

  logger.tool(
    'memory-qdrant-store',
    'upsert',
    `mode=default docs=${normalizedDocs.length} collection=${collection} payload=${JSON.stringify({
      points
    })}`
  );

  logger.debug(`[Qdrant][upsert] collection=${collection} points=${points.length}`);
  await client.upsert(collection, { points });

  await redisCacheService.invalidateAfterUpdate();
  methods.invalidateLocalCache();

  // Update model statistics for each stored memory
  for (const memory of memories) {
    try {
      const ltags = (memory.tags || []).map(t => t.toLowerCase());
      const knownTasks = new Set(['networking', 'security', 'optimization', 'troubleshooting', 'error-handling', 'installation', 'configuration', 'testing', 'deployment', 'database']);
      const task = ltags.find(t => knownTasks.has(t)) || 'general';
      const type = /```/.test(memory.text) || ltags.includes('pattern') ? 'pattern' : (ltags.includes('rule') ? 'rule' : 'context');
      const score = modelStats.calculateQualityScore(memory.label, task, type, memory.tags);
      await modelStats.processContribution(memory.llm_model_id, score, memory.label);
      
      const quality = score.quality;
      memoryStore.inc({ quality, tenant_id: tenantId });
      
      if (memory.chain) {
        memoryChainSize.observe({ tenant_id: tenantId }, memory.chain.step_count);
      }
    } catch { }
  }

  return memories;
}

