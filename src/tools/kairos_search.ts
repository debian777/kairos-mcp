import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { structuredLogger } from '../utils/structured-logger.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';
import { redisCacheService } from '../services/redis-cache.js';
import { mcpToolCalls, mcpToolDuration, mcpToolErrors, mcpToolInputSize, mcpToolOutputSize } from '../services/metrics/mcp-metrics.js';
import { getTenantId, runWithOptionalSpaceAsync, getSpaceContextFromStorage, getSpaceIdFromStorage } from '../utils/tenant-context.js';
import type { Memory } from '../types/memory.js';
import {
  SCORE_THRESHOLD,
  KAIROS_SEARCH_MAX_CHOICES,
  KAIROS_SEARCH_LIMIT_CAP,
  KAIROS_SEARCH_LIMIT_MIN,
  KAIROS_ENABLE_GROUP_COLLAPSE
} from '../config.js';
import { createResults, generateUnifiedOutput } from './kairos_search_output.js';
import { searchInputSchema, searchOutputSchema, type SearchInput, type SearchOutput } from './kairos_search_schema.js';

const CREATION_PROTOCOL_UUID = '00000000-0000-0000-0000-000000002001';
const CREATION_PROTOCOL_URI = `kairos://mem/${CREATION_PROTOCOL_UUID}`;
const REFINING_PROTOCOL_UUID = '00000000-0000-0000-0000-000000002002';
const REFINING_PROTOCOL_URI = `kairos://mem/${REFINING_PROTOCOL_UUID}`;
const REFINING_NEXT_ACTION = `call kairos_begin with ${REFINING_PROTOCOL_URI} to get step-by-step help turning the user's request into a better search query`;
const CREATE_NEXT_ACTION = `call kairos_begin with ${CREATION_PROTOCOL_URI} to create a new protocol`;

/** Strip built-in protocol URIs and UUIDs from query so they are not used for search or cache key. */
function queryForSearch(query: string): string {
  let q = (query || '').trim();
  for (const token of [REFINING_PROTOCOL_URI, REFINING_PROTOCOL_UUID, CREATION_PROTOCOL_URI, CREATION_PROTOCOL_UUID]) {
    q = q.replace(new RegExp(escapeRegex(token), 'gi'), ' ');
  }
  return q.replace(/\s+/g, ' ').trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface RegisterSearchOptions {
  toolName?: string;
  qdrantService?: QdrantService;
}

function addCandidate(
  candidateMap: Map<string, { memory: Memory; score: number }>,
  memory: Memory,
  score: number
): void {
  if (!memory) return;
  const key = memory.chain?.id || memory.memory_uuid;
  const existing = candidateMap.get(key);
  const incomingIsHead = memory.chain?.step_index === 1;
  if (!existing) {
    candidateMap.set(key, { memory, score });
    return;
  }
  const existingIsHead = existing.memory.chain?.step_index === 1;
  if (incomingIsHead && !existingIsHead) {
    candidateMap.set(key, { memory, score });
    return;
  }
  if (incomingIsHead === existingIsHead && score > existing.score) {
    candidateMap.set(key, { memory, score });
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

/** Core search: build candidates and return unified output. Used by executeSearch. */
async function doSearch(
  memoryStore: MemoryQdrantStore,
  qdrantService: QdrantService | undefined,
  searchQuery: string,
  effectiveLimit: number
): Promise<SearchOutput> {
  const candidateMap = await searchAndBuildCandidates(
    memoryStore,
    searchQuery,
    KAIROS_ENABLE_GROUP_COLLAPSE,
    effectiveLimit
  );
  let headCandidates = Array.from(candidateMap.values()).sort((a, b) => b.score - a.score);
  if (headCandidates.length > effectiveLimit) {
    headCandidates = headCandidates.slice(0, effectiveLimit);
  }
  const results = headCandidates.length > 0 ? createResults(headCandidates, SCORE_THRESHOLD) : [];
  return generateUnifiedOutput(results, qdrantService, {
    refiningUri: REFINING_PROTOCOL_URI,
    refiningNextAction: REFINING_NEXT_ACTION,
    createUri: CREATION_PROTOCOL_URI,
    createNextAction: CREATE_NEXT_ACTION
  });
}

/**
 * Shared execute: search for protocol chains. Used by MCP tool and HTTP route.
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
    const cacheKey = `begin:v3:${effectiveSpaceId}:${searchQuery}:${KAIROS_ENABLE_GROUP_COLLAPSE}:${effectiveLimit}`;

    const cachedResult = await redisCacheService.get(cacheKey);
    if (cachedResult) {
      return searchOutputSchema.parse(JSON.parse(cachedResult)) as SearchOutput;
    }

    const result = await doSearch(memoryStore, qdrantService, searchQuery, effectiveLimit);
    await redisCacheService.set(cacheKey, JSON.stringify(result), 300);
    return result;
  };

  return options?.runInSpace && spaceParam != null
    ? await options.runInSpace(runWithCache)
    : await runWithCache();
}

/**
 * Register kairos_search tool
 * 
 * V2 unified response: always must_obey: true, choices array with score/role,
 * creation protocol always available as fallback.
 */
export function registerSearchTool(server: any, memoryStore: MemoryQdrantStore, options: RegisterSearchOptions = {}) {
  const toolName = options.toolName || 'kairos_search';
  const qdrantService = options.qdrantService;

  structuredLogger.debug(`kairos_search registration inputSchema: ${JSON.stringify(searchInputSchema)}`);
  structuredLogger.debug(`kairos_search registration outputSchema: ${JSON.stringify(searchOutputSchema)}`);
  server.registerTool(
    toolName,
    {
      title: 'Search for protocol chains',
      description: getToolDoc('kairos_search') || 'Search for protocol chains matching the query. Always returns must_obey: true with a choices array. Follow next_action.',
      inputSchema: searchInputSchema,
      outputSchema: searchOutputSchema
    },
    async (params: unknown) => {
      const tenantId = getTenantId();
      mcpToolInputSize.observe({ tool: toolName, tenant_id: tenantId }, JSON.stringify(params).length);
      const timer = mcpToolDuration.startTimer({ tool: toolName, tenant_id: tenantId });

      const respond = (payload: SearchOutput) => {
        mcpToolCalls.inc({ tool: toolName, status: 'success', tenant_id: tenantId });
        mcpToolOutputSize.observe({ tool: toolName, tenant_id: tenantId }, JSON.stringify(payload).length);
        timer({ tool: toolName, status: 'success', tenant_id: tenantId });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
          structuredContent: payload
        };
      };

      try {
        const input = searchInputSchema.parse(params);
        const spaceParam = input.space ?? input.space_id;
        const runInSpace =
          spaceParam != null
            ? (fn: () => Promise<SearchOutput>) => runWithOptionalSpaceAsync(spaceParam, fn)
            : undefined;
        const output = await executeSearch(
          memoryStore,
          qdrantService,
          input,
          runInSpace != null ? { runInSpace } : undefined
        );
        return respond(output);
      } catch (error) {
        if (error instanceof Error && error.message === 'Requested space is not in your allowed spaces') {
          mcpToolCalls.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
          mcpToolErrors.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
          timer({ tool: toolName, status: 'error', tenant_id: tenantId });
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: 'forbidden', message: error.message }) }],
            isError: true
          };
        }
        const ctxErr = getSpaceContextFromStorage();
        structuredLogger.warn(`kairos_search error (returning empty results) space_id=${ctxErr?.defaultWriteSpaceId ?? 'default'}: ${error instanceof Error ? error.message : String(error)}`);
        mcpToolCalls.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
        mcpToolErrors.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
        timer({ tool: toolName, status: 'error', tenant_id: tenantId });
        const fallback = await generateUnifiedOutput([], qdrantService, {
          refiningUri: REFINING_PROTOCOL_URI,
          refiningNextAction: REFINING_NEXT_ACTION,
          createUri: CREATION_PROTOCOL_URI,
          createNextAction: CREATE_NEXT_ACTION
        });
        return respond(fallback);
      }
    }
  );
}
