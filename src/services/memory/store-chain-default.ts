import crypto from 'node:crypto';
import { QdrantClient } from '@qdrant/js-client-rest';
import type { Memory } from '../../types/memory.js';
import { logger } from '../../utils/logger.js';
import { IDGenerator } from '../id-generator.js';
import { KairosError } from '../../types/index.js';
import { embeddingService } from '../embedding/service.js';
import { CodeBlockProcessor } from '../code-block-processor.js';
import { MemoryQdrantStoreMethods } from './store-methods.js';
import { modelStats } from '../stats/model-stats.js';
import { redisCacheService } from '../redis-cache.js';
import {
  generateLabel,
  generateTags
} from '../../utils/memory-store-utils.js';
import { getEmbeddingDimension } from '../../config.js';
import { getSpaceContext } from '../../utils/tenant-context.js';
import { buildSpaceFilter } from '../../utils/space-filter.js';

function deriveDomainTaskType(label: string, text: string, tags: string[]) {
  const lower = (s: string) => (s || '').toLowerCase();
  const ltext = `${lower(label)}\n${lower(text)}`;
  const ltags = (tags || []).map(t => lower(t));

  const tasks = ['networking', 'security', 'optimization', 'troubleshooting', 'error-handling', 'installation', 'configuration', 'testing', 'deployment', 'database'] as const;

  const task = tasks.find(t => ltags.includes(t) || ltext.includes(t)) || 'general';

  let type: 'pattern' | 'rule' | 'context' = 'context';
  if (/```/.test(text) || ltags.includes('pattern') || ltext.includes('pattern')) type = 'pattern';
  else if (ltags.includes('rule') || ltext.includes('rule')) type = 'rule';

  return { task, type };
}

export async function processDefaultChain(
  client: QdrantClient,
  collection: string,
  codeBlockProcessor: CodeBlockProcessor,
  methods: MemoryQdrantStoreMethods,
  normalizedDocs: string[],
  llmModelId: string,
  now: Date,
  options: { forceUpdate?: boolean } = {}
): Promise<Memory[]> {
  // Default behavior: each doc becomes a memory
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

  // Duplicate pre-check for default path as well
  const dupReq2 = {
    filter: { must: [{ key: 'chain.id', match: { value: chainUuid } }] },
    limit: 256,
    with_payload: true,
    with_vector: false
  } as any;
  logger.debug(`[Qdrant][scroll-dup] collection=${collection} req=${JSON.stringify(dupReq2)}`);
  const chainFilter = buildSpaceFilter(getSpaceContext().allowedSpaceIds, { must: [{ key: 'chain.id', match: { value: chainUuid } }] });
  const dup = await client.scroll(collection, {
    filter: chainFilter,
    limit: 256,
    with_payload: true,
    with_vector: false
  } as any);
  logger.debug(`[Qdrant][scroll-dup] result_count=${dup?.points?.length || 0}`);

  if ((dup.points?.length || 0) > 0) {
    if (!options.forceUpdate) {
      const items = (dup.points || []).map((p: any) => ({
        label: (p.payload?.label as string) || 'Memory',
        uri: `kairos://mem/${String(p.id)}`
      }));
      throw new KairosError('Duplicate memory chain', 'DUPLICATE_CHAIN', 409, { chain_id: chainUuid, items });
    }
    const delReq2 = { filter: chainFilter } as any;
    logger.debug(`[Qdrant][delete-chain] collection=${collection} req=${JSON.stringify(delReq2)}`);
    await client.delete(collection, delReq2);
  }

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
    const codeTags = processed.codeResult.allIdentifiers.slice(0, 5); // Limit to prevent tag explosion
    const allTags = [...baseTags, ...codeTags];

    const stepLabel = generateLabel(processed.original);
    return {
      memory_uuid,
      label: stepLabel, // step (document) title
      tags: allTags,
      text: processed.enhanced, // Use enhanced text with code identifiers
      llm_model_id: llmModelId,
      created_at: now.toISOString(),
      chain: {
        id: chainUuid,
        label: firstGeneratedLabel, // chain title for multi-doc path
        step_index: index + 1,
        step_count: normalizedDocs.length
      }
    };
  });

  const spaceId = getSpaceContext().defaultWriteSpaceId;
  const points = memories.map((memory, index) => {
    // classify + quality metadata
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
        space_id: spaceId,
        label: memory.label,
        tags: memory.tags,
        text: memory.text,
        llm_model_id: memory.llm_model_id,
        created_at: memory.created_at,
        task,
        type,
        quality_metadata: {
          step_quality_score: qualityMetadata.step_quality_score,
          step_quality: qualityMetadata.step_quality
        },
        // memory chain metadata (nested object)
        chain: {
          id: memory.chain!.id,
          label: memory.chain!.label,
          step_index: memory.chain!.step_index,
          step_count: memory.chain!.step_count
        }
      }
    });
  });

  // Debug: log full payload for the default path as well
  logger.tool(
    'memory-qdrant-store',
    'upsert',
    `mode=default docs=${normalizedDocs.length} collection=${collection} payload=${JSON.stringify({
      points
    })}`
  );

  logger.debug(`[Qdrant][upsert] collection=${collection} points=${points.length}`);
  await client.upsert(collection, { points });

  // Publish cache invalidation
  await redisCacheService.invalidateAfterUpdate();
  // Invalidate local in-process cache so searches see new points
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
    } catch { }
  }

  return memories;
}