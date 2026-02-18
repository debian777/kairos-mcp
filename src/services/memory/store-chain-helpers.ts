import { logger } from '../../utils/logger.js';
import { QdrantClient } from '@qdrant/js-client-rest';
import { KairosError } from '../../types/index.js';
import { SIMILAR_MEMORY_THRESHOLD } from '../../config.js';
import type { MemoryQdrantStoreMethods } from './store-methods.js';

/**
 * Derives domain task type from label, text, and tags
 */
export function deriveDomainTaskType(label: string, text: string, tags: string[]) {
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

/**
 * Checks for duplicate chain by chain UUID
 */
export async function checkDuplicateChain(
  client: QdrantClient,
  collection: string,
  chainUuid: string
): Promise<{ points: any[] }> {
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
  return dup;
}

/**
 * Handles duplicate chain: either throws error or deletes existing chain
 */
export async function handleDuplicateChain(
  client: QdrantClient,
  collection: string,
  chainUuid: string,
  forceUpdate: boolean
): Promise<void> {
  const dup = await checkDuplicateChain(client, collection, chainUuid);

  if ((dup.points?.length || 0) > 0) {
    if (!forceUpdate) {
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
}

/**
 * Checks for similar memories by title/label before creating a new memory.
 * If a very high match is found (score >= SIMILAR_MEMORY_THRESHOLD), throws an error with existing memory info.
 * This helps prevent duplicate memories that pollute search results.
 * Set SIMILAR_MEMORY_THRESHOLD=1 in env to effectively disable.
 */
export async function checkSimilarMemoryByTitle(
  methods: MemoryQdrantStoreMethods,
  label: string,
  forceUpdate: boolean
): Promise<void> {
  // Skip check if force update is enabled
  if (forceUpdate) {
    return;
  }

  // Search for existing memories with similar title
  const { memories, scores } = await methods.searchMemories(label, 10, false);
  
  if (memories.length === 0 || scores.length === 0) {
    return;
  }

  // Find the highest scoring match
  let bestMatch = memories[0]!;
  let bestScore = scores[0] ?? 0;
  for (let i = 1; i < memories.length; i++) {
    const score = scores[i] ?? 0;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = memories[i]!;
    }
  }

  // If match is very high (>= threshold), inform about existing memory
  if (bestScore >= SIMILAR_MEMORY_THRESHOLD) {
    const uri = `kairos://mem/${bestMatch.memory_uuid}`;
    const existingMemory = {
      uri,
      memory_uuid: bestMatch.memory_uuid,
      label: bestMatch.label,
      chain_label: bestMatch.chain?.label || null,
      score: bestScore,
      total_steps: bestMatch.chain?.step_count || 1
    };
    const next_action = `call kairos_begin with ${uri} to read the existing protocol; compare with your mint payload, then either call kairos_mint with force_update: true to replace it or modify title/content to create a distinct memory`;
    const content_preview = [bestMatch.label, bestMatch.text].filter(Boolean).join('\n').slice(0, 300);

    logger.warn(
      `[MemoryQdrantStore] Similar memory found by title: "${label}" matches "${bestMatch.label}" with score ${bestScore.toFixed(3)}`
    );

    throw new KairosError(
      'Similar memory found by title',
      'SIMILAR_MEMORY_FOUND',
      409,
      {
        existing_memory: existingMemory,
        similarity_score: bestScore,
        message: `A very similar memory already exists with title "${bestMatch.label}" (similarity: ${Math.round(bestScore * 100)}%). Verify it before overwriting.`,
        must_obey: true,
        next_action,
        content_preview
      }
    );
  }
}

