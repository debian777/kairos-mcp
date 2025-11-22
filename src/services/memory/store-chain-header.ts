import { QdrantClient } from '@qdrant/js-client-rest';
import type { Memory } from '../../types/memory.js';
import { logger } from '../../utils/logger.js';
import { IDGenerator } from '../id-generator.js';
import { KairosError } from '../../types/index.js';
import { embeddingService } from '../embedding/service.js';
import { MemoryQdrantStoreMethods } from './store-methods.js';
import { knowledgeGame } from '../game/knowledge-game.js';
import { redisCacheService } from '../redis-cache.js';
import { getEmbeddingDimension } from '../../config.js';

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

export async function processHeaderBasedChain(
  client: QdrantClient,
  collection: string,
  methods: MemoryQdrantStoreMethods,
  markdownDoc: string,
  llmModelId: string,
  now: Date,
  options: { forceUpdate?: boolean } = {}
): Promise<Memory[]> {
  const headerChainMemories = methods.buildHeaderMemoryChain(markdownDoc, llmModelId, now);

  if (headerChainMemories.length === 0) {
    return [];
  }

  // Determine chain label and deterministic v5 chain UUID (prefer explicit chain.label)
  const firstLabel = headerChainMemories[0]?.label || 'Knowledge Chain';
  const explicitChainLabel = headerChainMemories[0]?.chain?.label;
  const chainLabel = (explicitChainLabel && explicitChainLabel.trim().length > 0)
    ? explicitChainLabel.trim()
    : (firstLabel.includes(':') ? firstLabel.split(':')[0]!.trim() : firstLabel.trim());
  const chainUuid = IDGenerator.generateChainUUIDv5(chainLabel);

  // Duplicate pre-check by chain.id
  const dupReq = {
    filter: { must: [{ key: 'chain.id', match: { value: chainUuid } }] },
    limit: 256,
    with_payload: true,
    with_vector: false
  } as any;
  logger.debug(`[Qdrant][scroll-dup] collection=${collection} req=${JSON.stringify(dupReq)}`);
  const dup = await client.scroll(collection, {
    filter: { must: [{ key: 'chain.id', match: { value: chainUuid } }] },
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
    const delReq = { filter: { must: [{ key: 'chain.id', match: { value: chainUuid } }] } } as any;
    logger.debug(`[Qdrant][delete-chain] collection=${collection} req=${JSON.stringify(delReq)}`);
    await client.delete(collection, delReq);
  }

  // Generate embeddings for each H2 section to upsert proper vectors.
  const sectionTexts = headerChainMemories.map(m => m.text);
  const vectorSize = getEmbeddingDimension();
  const currentVectorName = `vs${vectorSize}`;
  let vectors: number[][];
  try {
    const batch = await embeddingService.generateBatchEmbeddings(sectionTexts);
    vectors = batch.embeddings;
    // Basic safety checks: shape and dimension
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

  const points = headerChainMemories.map((memory, i) => {
    const dtt = deriveDomainTaskType(memory.label, memory.text, memory.tags);
    const gem = knowledgeGame.calculateStepGemMetadata(
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
        label: memory.label,
        tags: memory.tags,
        text: memory.text,
        llm_model_id: memory.llm_model_id,
        created_at: memory.created_at,
        // basic classification for game + filtering (domain removed)
        task: dtt.task,
        type: dtt.type,
        // gem metadata (no execution context on store)
        gem_metadata: {
          step_gem_potential: gem.step_gem_potential,
          step_quality: gem.step_quality,
          motivational_text: gem.motivational_text
        },
        // memory chain metadata (nested object)
        chain: {
          id: chainUuid,
          label: chainLabel,
          step_index: i + 1,
          step_count: chainStepCount
        }
      }
    });
  });

  // Debug: log exactly what we send to Qdrant in the header-based path
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
  // Invalidate local in-process cache so searches see new points
  methods.invalidateLocalCache();

  // Update Knowledge Mining Game leaderboard for each stored step
  for (const memory of headerChainMemories) {
    try {
      const { task, type } = deriveDomainTaskType(memory.label, memory.text, memory.tags);
      const score = knowledgeGame.calculateGemScore(memory.label, task, type, memory.tags);
      await knowledgeGame.processGemDiscovery(memory.llm_model_id, score, memory.label);
    } catch { }
  }

  return headerChainMemories;
}