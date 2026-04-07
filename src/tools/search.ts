import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { redisCacheService } from '../services/redis-cache.js';
import {
  getRequestIdFromStorage,
  getTenantId,
  getSpaceIdFromStorage,
  getSpaceContextFromStorage
} from '../utils/tenant-context.js';
import type { Memory } from '../types/memory.js';
import {
  SCORE_THRESHOLD,
  KAIROS_SEARCH_MAX_CHOICES,
  KAIROS_SEARCH_LIMIT_CAP,
  KAIROS_SEARCH_LIMIT_MIN,
  KAIROS_ENABLE_GROUP_COLLAPSE,
  USE_REDIS
} from '../config.js';
import { createResults, generateUnifiedOutput } from './search_output.js';
import { searchOutputSchema, type SearchInput, type SearchOutput } from './search_schema.js';
import { logSearchAnomaly } from '../services/embedding/audit.js';
import { structuredLogger } from '../utils/structured-logger.js';
import {
  KAIROS_CREATION_FOOTER_NEXT_ACTION,
  KAIROS_CREATION_PROTOCOL_UUID,
  KAIROS_REFINING_PROTOCOL_UUID
} from '../constants/builtin-search-meta.js';
import { buildAdapterUri } from './kairos-uri.js';

const CREATION_PROTOCOL_URI = buildAdapterUri(KAIROS_CREATION_PROTOCOL_UUID);
const REFINING_PROTOCOL_URI = buildAdapterUri(KAIROS_REFINING_PROTOCOL_UUID);
const REFINING_NEXT_ACTION = `call forward with ${REFINING_PROTOCOL_URI} to execute the refine adapter`;
const CREATE_NEXT_ACTION = KAIROS_CREATION_FOOTER_NEXT_ACTION;

/** Strip built-in protocol URIs and UUIDs from query so they are not used for search or cache key. */
function queryForSearch(query: string): string {
  let q = (query || '').trim();
  for (const token of [
    REFINING_PROTOCOL_URI,
    KAIROS_REFINING_PROTOCOL_UUID,
    CREATION_PROTOCOL_URI,
    KAIROS_CREATION_PROTOCOL_UUID
  ]) {
    q = q.replace(new RegExp(escapeRegex(token), 'gi'), ' ');
  }
  return q.replace(/\s+/g, ' ').trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const SCORE_TIE_EPS = 1e-9;

/** TTL (seconds) for activate/search unified cache entries written to the key-value store. */
const ACTIVATE_SEARCH_CACHE_TTL_SEC = 300;

function addCandidate(
  candidateMap: Map<string, { memory: Memory; score: number }>,
  memory: Memory,
  score: number
): void {
  if (!memory) return;
  const key = memory.adapter?.id || memory.memory_uuid;
  const existing = candidateMap.get(key);
  const incomingIsHead = memory.adapter?.layer_index === 1;
  const defaultWrite = getSpaceContextFromStorage().defaultWriteSpaceId;
  if (!existing) {
    candidateMap.set(key, { memory, score });
    return;
  }
  const existingIsHead = existing.memory.adapter?.layer_index === 1;
  if (incomingIsHead && !existingIsHead) {
    candidateMap.set(key, { memory, score });
    return;
  }
  if (!incomingIsHead && existingIsHead) {
    return;
  }
  if (score > existing.score + SCORE_TIE_EPS) {
    candidateMap.set(key, { memory, score });
    return;
  }
  if (Math.abs(score - existing.score) <= SCORE_TIE_EPS) {
    const incomingPersonal = memory.space_id === defaultWrite;
    const existingPersonal = existing.memory.space_id === defaultWrite;
    if (incomingPersonal && !existingPersonal) {
      candidateMap.set(key, { memory, score });
    }
  }
}

async function searchAndBuildCandidates(
  memoryStore: MemoryQdrantStore,
  query: string,
  enableGroupCollapse: boolean,
  maxChoices: number
): Promise<Map<string, { memory: Memory; score: number }>> {
  const candidateMap = new Map<string, { memory: Memory; score: number }>();
  const firstLimit = Math.min(200, Math.max(40, maxChoices * 3));
  const { memories, scores } = await memoryStore.searchMemories(query, firstLimit, enableGroupCollapse);
  memories.forEach((memory, idx) => addCandidate(candidateMap, memory, scores[idx] ?? 0));

  if (candidateMap.size < Math.max(10, maxChoices) && enableGroupCollapse) {
    const secondLimit = Math.min(200, Math.max(80, maxChoices * 3));
    const { memories: moreMemories, scores: moreScores } = await memoryStore.searchMemories(query, secondLimit, false);
    moreMemories.forEach((memory, idx) => addCandidate(candidateMap, memory, moreScores[idx] ?? 0));
  }

  return candidateMap;
}

/** Never throws: footer versions are optional; Qdrant errors must not break search or the error fallback. */
async function resolveFooterProtocolVersions(
  memoryStore: MemoryQdrantStore
): Promise<{ refine: string | null; create: string | null }> {
  try {
    const [refineMem, createMem] = await Promise.all([
      memoryStore.getMemory(KAIROS_REFINING_PROTOCOL_UUID),
      memoryStore.getMemory(KAIROS_CREATION_PROTOCOL_UUID)
    ]);
    return {
      refine: refineMem?.adapter?.protocol_version ?? null,
      create: createMem?.adapter?.protocol_version ?? null
    };
  } catch (err) {
    structuredLogger.warn(
      `search resolveFooterProtocolVersions: ${err instanceof Error ? err.message : String(err)}`
    );
    return { refine: null, create: null };
  }
}

/** Core search: build candidates and return unified output. Used by executeSearch. */
async function doSearch(
  memoryStore: MemoryQdrantStore,
  qdrantService: QdrantService | undefined,
  searchQuery: string,
  effectiveLimit: number
): Promise<SearchOutput> {
  const tenantId = getTenantId();
  const requestId = getRequestIdFromStorage();
  const footerVersions = await resolveFooterProtocolVersions(memoryStore);
  const candidateMap = await searchAndBuildCandidates(
    memoryStore,
    searchQuery,
    KAIROS_ENABLE_GROUP_COLLAPSE,
    effectiveLimit
  );
  const defaultWriteForSort = getSpaceContextFromStorage().defaultWriteSpaceId;
  let headCandidates = Array.from(candidateMap.values()).sort((a, b) => {
    const byScore = b.score - a.score;
    if (Math.abs(byScore) > SCORE_TIE_EPS) return byScore;
    const aPersonal = a.memory.space_id === defaultWriteForSort ? 1 : 0;
    const bPersonal = b.memory.space_id === defaultWriteForSort ? 1 : 0;
    return bPersonal - aPersonal;
  });
  if (headCandidates.length > effectiveLimit) {
    headCandidates = headCandidates.slice(0, effectiveLimit);
  }
  const results = headCandidates.length > 0 ? createResults(headCandidates, SCORE_THRESHOLD) : [];
  logSearchAnomaly({
    tenantId,
    requestId,
    resultCount: results.length,
    queryLength: searchQuery.length,
    topScore: results[0]?.score ?? null
  });
  return generateUnifiedOutput(results, qdrantService, {
    refiningUri: REFINING_PROTOCOL_URI,
    refiningNextAction: REFINING_NEXT_ACTION,
    createUri: CREATION_PROTOCOL_URI,
    createNextAction: CREATE_NEXT_ACTION,
    refiningProtocolVersion: footerVersions.refine,
    createProtocolVersion: footerVersions.create
  });
}

/**
 * Shared execute: search for protocol adapters. Used by MCP tool and HTTP route.
 * When runInSpace is provided and input has space/space_id, the search runs in that space context.
 */
export async function executeSearch(
  memoryStore: MemoryQdrantStore,
  qdrantService: QdrantService | undefined,
  input: SearchInput,
  options?: { runInSpace?: (fn: () => Promise<SearchOutput>) => Promise<SearchOutput> }
): Promise<SearchOutput> {
  const { query, space, space_id, max_choices } = input;
  const spaceParam = space ?? space_id;
  const effectiveLimit = Math.max(
    KAIROS_SEARCH_LIMIT_MIN,
    Math.min(KAIROS_SEARCH_LIMIT_CAP, max_choices ?? KAIROS_SEARCH_MAX_CHOICES)
  );
  const searchQuery = queryForSearch(query);

  const runWithCache = async (): Promise<SearchOutput> => {
    const effectiveSpaceId = spaceParam ?? getSpaceIdFromStorage();
    const cacheKey = `activate:v6:${effectiveSpaceId}:${searchQuery}:${KAIROS_ENABLE_GROUP_COLLAPSE}:${effectiveLimit}`;
    const tenantId = getTenantId();
    const requestId = getRequestIdFromStorage();
    const cacheDebugBase: Record<string, unknown> = {
      component: 'activate_search_cache',
      cache_backend: USE_REDIS ? 'redis' : 'memory',
      cache_key_version: 'v6',
      group_collapse: KAIROS_ENABLE_GROUP_COLLAPSE,
      effective_limit: effectiveLimit,
      normalized_query_len: searchQuery.length,
      effective_space_id: effectiveSpaceId,
      explicit_space_param: spaceParam != null,
      tenant_id: tenantId,
      request_id: requestId
    };

    const cachedResult = await redisCacheService.get(cacheKey);
    if (cachedResult) {
      structuredLogger.debug(
        {
          ...cacheDebugBase,
          cache_lookup: 'hit',
          configured_store_ttl_seconds: ACTIVATE_SEARCH_CACHE_TTL_SEC
        },
        'activate search cache hit'
      );
      return searchOutputSchema.parse(JSON.parse(cachedResult)) as SearchOutput;
    }

    const result = await doSearch(memoryStore, qdrantService, searchQuery, effectiveLimit);
    await redisCacheService.set(cacheKey, JSON.stringify(result), ACTIVATE_SEARCH_CACHE_TTL_SEC);
    structuredLogger.debug(
      {
        ...cacheDebugBase,
        cache_lookup: 'miss',
        configured_store_ttl_seconds: ACTIVATE_SEARCH_CACHE_TTL_SEC
      },
      'activate search cache miss; stored'
    );
    return result;
  };

  return options?.runInSpace && spaceParam != null
    ? await options.runInSpace(runWithCache)
    : await runWithCache();
}
