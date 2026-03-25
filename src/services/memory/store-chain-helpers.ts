import { logger } from '../../utils/structured-logger.js';
import { QdrantClient } from '@qdrant/js-client-rest';
import { KairosError } from '../../types/index.js';
import { SIMILAR_MEMORY_THRESHOLD } from '../../config.js';
import { getSpaceContext } from '../../utils/tenant-context.js';
import { buildSpaceFilter } from '../../utils/space-filter.js';
import type { MemoryQdrantStoreMethods } from './store-methods.js';
import { MAX_AUTO_SUFFIX_ATTEMPTS, nextAutoSlugCandidate } from '../../utils/protocol-slug.js';

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
  const filter = buildSpaceFilter(getSpaceContext().allowedSpaceIds, { must: [{ key: 'chain.id', match: { value: chainUuid } }] });
  const dupReq = { filter, limit: 256, with_payload: true, with_vector: false } as any;
  logger.debug(`[Qdrant][scroll-dup] collection=${collection} req=${JSON.stringify(dupReq)}`);
  const dup = await client.scroll(collection, dupReq);
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
    const filter = buildSpaceFilter(getSpaceContext().allowedSpaceIds, { must: [{ key: 'chain.id', match: { value: chainUuid } }] });
    const delReq = { filter } as any;
    logger.debug(`[Qdrant][delete-chain] collection=${collection} req=${JSON.stringify(delReq)}`);
    await client.delete(collection, delReq);
  }
}

/** Max length for embedded mint-similarity query (chain + first step). */
const MINT_SIMILARITY_QUERY_MAX = 400;

/**
 * Text for pre-mint similarity search: chain identity plus first step title.
 * Mandatory step headings match across protocols; chain title differentiates.
 */
export function buildMintSimilaritySearchQuery(chainTitle: string, stepTitle: string): string {
  const c = chainTitle.trim();
  const s = stepTitle.trim();
  if (!c && !s) return 'Memory';
  if (!s) return c.slice(0, MINT_SIMILARITY_QUERY_MAX);
  if (!c) return s.slice(0, MINT_SIMILARITY_QUERY_MAX);
  return `${c}\n${s}`.slice(0, MINT_SIMILARITY_QUERY_MAX);
}

/**
 * Similarity guard before mint: vector search on chain title + first step title (not step alone).
 * Set SIMILAR_MEMORY_THRESHOLD=1 in env to effectively disable.
 */
export async function checkSimilarMemoryByTitle(
  methods: MemoryQdrantStoreMethods,
  chainTitle: string,
  stepTitle: string,
  forceUpdate: boolean
): Promise<void> {
  // Skip check if force update is enabled
  if (forceUpdate) {
    return;
  }

  const label = buildMintSimilaritySearchQuery(chainTitle, stepTitle);

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
    const next_action = `call kairos_dump with uri ${uri} and protocol: true to get markdown_doc; compare with your mint payload, then either kairos_mint(..., force_update: true) to replace or change document to mint distinct`;
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

/** Input for resolving a unique slug before chain upsert (after handleDuplicateChain). */
export interface ProtocolSlugMintInput {
  slug: string;
  authorSupplied: boolean;
}

async function scrollPointsWithSlug(
  client: QdrantClient,
  collection: string,
  slug: string
): Promise<Array<{ id: string | number; payload: Record<string, unknown> }>> {
  const allowed = getSpaceContext().allowedSpaceIds;
  const filter = buildSpaceFilter(allowed, { must: [{ key: 'slug', match: { value: slug } }] });
  const dup = await client.scroll(collection, {
    filter,
    limit: 24,
    with_payload: true,
    with_vector: false
  } as any);
  return (dup.points ?? []).map((p: any) => ({ id: p.id, payload: p.payload || {} }));
}

/**
 * Allocate a slug that does not collide with another chain in allowed spaces.
 * Author slugs: exact collision with a different chain → DUPLICATE_SLUG.
 * Auto slugs: append -2, -3, … until free.
 */
export async function allocateProtocolSlugForMint(
  client: QdrantClient,
  collection: string,
  input: ProtocolSlugMintInput,
  newChainUuid: string
): Promise<string> {
  const { slug: baseSlug, authorSupplied } = input;

  async function usedByOtherChain(candidate: string): Promise<{ otherChainId: string; sample_uri?: string } | null> {
    const hits = await scrollPointsWithSlug(client, collection, candidate);
    for (const h of hits) {
      const chainObj = h.payload['chain'] as { id?: string } | undefined;
      const chainId = chainObj && typeof chainObj.id === 'string' ? chainObj.id : undefined;
      if (chainId && chainId !== newChainUuid) {
        return {
          otherChainId: chainId,
          sample_uri: `kairos://mem/${String(h.id)}`
        };
      }
    }
    return null;
  }

  if (authorSupplied) {
    const clash = await usedByOtherChain(baseSlug);
    if (clash) {
      throw new KairosError(
        `Slug "${baseSlug}" is already used by another protocol in this space.`,
        'DUPLICATE_SLUG',
        409,
        {
          slug: baseSlug,
          chain_id: clash.otherChainId,
          sample_uri: clash.sample_uri
        }
      );
    }
    return baseSlug;
  }

  for (let attempt = 1; attempt <= MAX_AUTO_SUFFIX_ATTEMPTS; attempt++) {
    const candidate = nextAutoSlugCandidate(baseSlug, attempt);
    const clash = await usedByOtherChain(candidate);
    if (!clash) return candidate;
  }

  throw new KairosError(
    `Could not allocate a unique slug from "${baseSlug}" after ${MAX_AUTO_SUFFIX_ATTEMPTS} attempts.`,
    'SLUG_ALLOCATION_EXHAUSTED',
    409,
    { base_slug: baseSlug }
  );
}
