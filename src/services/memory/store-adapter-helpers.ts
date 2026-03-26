import { logger } from '../../utils/structured-logger.js';
import { QdrantClient } from '@qdrant/js-client-rest';
import { KairosError } from '../../types/index.js';
import { SIMILAR_MEMORY_THRESHOLD } from '../../config.js';
import { getSpaceContext } from '../../utils/tenant-context.js';
import { buildSpaceFilter } from '../../utils/space-filter.js';
import type { MemoryQdrantStoreMethods } from './store-methods.js';
import { buildAdapterUri, buildLayerUri } from '../../tools/kairos-uri.js';
import { MAX_AUTO_SUFFIX_ATTEMPTS, nextAutoSlugCandidate } from '../../utils/protocol-slug.js';

/**
 * Derives domain task type from label, text, and tags.
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
 * Checks for duplicate adapter by adapter UUID.
 */
export async function checkDuplicateAdapter(
  client: QdrantClient,
  collection: string,
  adapterUuid: string
): Promise<{ points: any[] }> {
  const filter = buildSpaceFilter(getSpaceContext().allowedSpaceIds, {
    must: [{ key: 'adapter.id', match: { value: adapterUuid } }]
  });
  const dupReq = { filter, limit: 256, with_payload: true, with_vector: false } as any;
  logger.debug(`[Qdrant][scroll-dup] collection=${collection} req=${JSON.stringify(dupReq)}`);
  const dup = await client.scroll(collection, dupReq);
  logger.debug(`[Qdrant][scroll-dup] result_count=${dup?.points?.length || 0}`);
  return dup;
}

/**
 * Handles duplicate adapter: either throws error or deletes the existing adapter.
 */
export async function handleDuplicateAdapter(
  client: QdrantClient,
  collection: string,
  adapterUuid: string,
  forceUpdate: boolean
): Promise<void> {
  const dup = await checkDuplicateAdapter(client, collection, adapterUuid);

  if ((dup.points?.length || 0) > 0) {
    if (!forceUpdate) {
      const items = (dup.points || []).map((p: any) => ({
        label: (p.payload?.label as string) || 'Memory',
        uri: `kairos://mem/${String(p.id)}`
      }));
      throw new KairosError('Duplicate adapter', 'DUPLICATE_ADAPTER', 409, { adapter_id: adapterUuid, items });
    }
    const filter = buildSpaceFilter(getSpaceContext().allowedSpaceIds, {
      must: [{ key: 'adapter.id', match: { value: adapterUuid } }]
    });
    const delReq = { filter } as any;
    logger.debug(`[Qdrant][delete-adapter] collection=${collection} req=${JSON.stringify(delReq)}`);
    await client.delete(collection, delReq);
  }
}

/** Max length for embedded mint-similarity query (adapter + first layer). */
const ADAPTER_SIMILARITY_QUERY_MAX = 400;

/**
 * Text for pre-mint similarity search: adapter identity plus first layer title.
 * Mandatory layer headings match across protocols; adapter title differentiates.
 */
export function buildAdapterSimilaritySearchQuery(adapterTitle: string, layerTitle: string): string {
  const a = adapterTitle.trim();
  const l = layerTitle.trim();
  if (!a && !l) return 'Memory';
  if (!l) return a.slice(0, ADAPTER_SIMILARITY_QUERY_MAX);
  if (!a) return l.slice(0, ADAPTER_SIMILARITY_QUERY_MAX);
  return `${a}\n${l}`.slice(0, ADAPTER_SIMILARITY_QUERY_MAX);
}

/**
 * Similarity guard before mint: vector search on adapter title + first layer title (not layer alone).
 * Set SIMILAR_MEMORY_THRESHOLD=1 in env to effectively disable.
 */
export async function checkSimilarAdapterByTitle(
  methods: MemoryQdrantStoreMethods,
  adapterTitle: string,
  layerTitle: string,
  forceUpdate: boolean
): Promise<void> {
  if (forceUpdate) {
    return;
  }

  const label = buildAdapterSimilaritySearchQuery(adapterTitle, layerTitle);

  const { memories, scores } = await methods.searchMemories(label, 10, false);

  if (memories.length === 0 || scores.length === 0) {
    return;
  }

  let bestMatch = memories[0]!;
  let bestScore = scores[0] ?? 0;
  for (let i = 1; i < memories.length; i++) {
    const score = scores[i] ?? 0;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = memories[i]!;
    }
  }

  if (bestScore >= SIMILAR_MEMORY_THRESHOLD) {
    const adapterUri = bestMatch.adapter?.id ? buildAdapterUri(bestMatch.adapter.id) : buildLayerUri(bestMatch.memory_uuid);
    const layerUri = buildLayerUri(bestMatch.memory_uuid);
    const existingMemory = {
      uri: layerUri,
      memory_uuid: bestMatch.memory_uuid,
      label: bestMatch.label,
      adapter_name: bestMatch.adapter?.name ?? null,
      score: bestScore,
      layer_count: bestMatch.adapter?.layer_count ?? 1
    };
    const next_action = `call export with ${adapterUri} and format "markdown" to inspect the existing adapter, then either call train with force_update: true to replace it or revise the markdown and train a distinct adapter`;
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

/** Input for resolving a unique slug before adapter upsert (after handleDuplicateAdapter). */
export interface AdapterSlugMintInput {
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
 * Allocate a slug that does not collide with another adapter in allowed spaces.
 * Author slugs: exact collision with a different adapter -> DUPLICATE_SLUG.
 * Auto slugs: append -2, -3, ... until free.
 */
export async function allocateAdapterSlugForMint(
  client: QdrantClient,
  collection: string,
  input: AdapterSlugMintInput,
  newAdapterUuid: string
): Promise<string> {
  const { slug: baseSlug, authorSupplied } = input;

  async function usedByOtherAdapter(candidate: string): Promise<{ otherAdapterId: string; sample_uri?: string } | null> {
    const hits = await scrollPointsWithSlug(client, collection, candidate);
    for (const h of hits) {
      const adapterId = typeof (h.payload['adapter'] as { id?: string } | undefined)?.id === 'string'
        ? (h.payload['adapter'] as { id: string }).id
        : undefined;
      if (adapterId && adapterId !== newAdapterUuid) {
        return {
          otherAdapterId: adapterId,
          sample_uri: `kairos://mem/${String(h.id)}`
        };
      }
    }
    return null;
  }

  if (authorSupplied) {
    const clash = await usedByOtherAdapter(baseSlug);
    if (clash) {
      throw new KairosError(
        `Slug "${baseSlug}" is already used by another protocol in this space.`,
        'DUPLICATE_SLUG',
        409,
        {
          slug: baseSlug,
          adapter_id: clash.otherAdapterId,
          sample_uri: clash.sample_uri
        }
      );
    }
    return baseSlug;
  }

  for (let attempt = 1; attempt <= MAX_AUTO_SUFFIX_ATTEMPTS; attempt++) {
    const candidate = nextAutoSlugCandidate(baseSlug, attempt);
    const clash = await usedByOtherAdapter(candidate);
    if (!clash) return candidate;
  }

  throw new KairosError(
    `Could not allocate a unique slug from "${baseSlug}" after ${MAX_AUTO_SUFFIX_ATTEMPTS} attempts.`,
    'SLUG_ALLOCATION_EXHAUSTED',
    409,
    { base_slug: baseSlug }
  );
}
