import { z } from 'zod';
import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { structuredLogger } from '../utils/structured-logger.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';
import { redisCacheService } from '../services/redis-cache.js';
import { mcpToolCalls, mcpToolDuration, mcpToolErrors, mcpToolInputSize, mcpToolOutputSize } from '../services/metrics/mcp-metrics.js';
import { getTenantId, getSpaceContextFromStorage, runWithOptionalSpaceAsync } from '../utils/tenant-context.js';
import type { Memory } from '../types/memory.js';
import {
  SCORE_THRESHOLD,
  KAIROS_SEARCH_MAX_CHOICES,
  KAIROS_SEARCH_LIMIT_CAP,
  KAIROS_SEARCH_LIMIT_MIN,
  KAIROS_ENABLE_GROUP_COLLAPSE
} from '../config.js';
import { createResults, generateUnifiedOutput } from './kairos_search_output.js';

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
  normalizedQuery: string,
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

/**
 * Register kairos_search tool
 *
 * V2 unified response: always must_obey: true, choices array with score/role,
 * creation protocol always available as fallback.
 */
export function registerSearchTool(server: any, memoryStore: MemoryQdrantStore, options: RegisterSearchOptions = {}) {
  const toolName = options.toolName || 'kairos_search';
  const memoryUriSchema = z.string().regex(/^kairos:\/\/mem\/[0-9a-f-]{36}$/i, 'must match kairos://mem/{uuid}');
  const inputSchema = z.object({
    query: z.string().min(1).describe('Search query for chain heads'),
    space: z.string().optional().describe('Scope results to this space (must be in your allowed spaces)'),
    space_id: z.string().optional().describe('Alias for space'),
    max_choices: z
      .number()
      .int()
      .min(KAIROS_SEARCH_LIMIT_MIN)
      .max(KAIROS_SEARCH_LIMIT_CAP)
      .optional()
      .describe('Max match choices to return. Omit for server default; use higher for broad/vague queries.')
  });
  const outputSchema = z.object({
    must_obey: z.boolean().describe('Always true. Follow next_action.'),
    message: z.string().describe('Human-readable summary'),
    next_action: z.string().describe("You MUST pick the top choice (index 0) and follow that choice's next_action."),
    choices: z.array(z.object({
      uri: memoryUriSchema,
      label: z.string(),
      chain_label: z.string().nullable(),
      score: z.number().nullable().describe('0.0-1.0 for matches, null for refine/create'),
      role: z.enum(['match', 'refine', 'create']).describe('match = search result, refine = search again, create = system action'),
      tags: z.array(z.string()),
      next_action: z.string().describe('Instruction for this choice: call kairos_begin with this choice\'s uri.'),
      protocol_version: z.string().nullable().describe('Stored protocol version (e.g. semver) for match choices; null for refine/create.')
    })).describe('Best action is always at index 0; follow that choice\'s next_action.')
  });

  server.registerTool(
    toolName,
    {
      title: 'Search for protocol chains',
      description: getToolDoc('kairos_search') || 'Search for protocol chains matching the query. Always returns must_obey: true with a choices array. Follow next_action.',
      inputSchema,
      outputSchema
    },
    async (params: any) => {
      const tenantId = getTenantId();
      const { query, space, space_id, max_choices } = params as {
        query: string;
        space?: string;
        space_id?: string;
        max_choices?: number;
      };
      const spaceParam = space ?? space_id;
      const effectiveLimit = Math.max(
        KAIROS_SEARCH_LIMIT_MIN,
        Math.min(KAIROS_SEARCH_LIMIT_CAP, max_choices ?? KAIROS_SEARCH_MAX_CHOICES)
      );
      const inputSize = JSON.stringify({ query }).length;
      mcpToolInputSize.observe({ tool: toolName, tenant_id: tenantId }, inputSize);
      const timer = mcpToolDuration.startTimer({ tool: toolName, tenant_id: tenantId });
      const respond = (payload: any) => {
        const structured = { content: [{ type: 'text', text: JSON.stringify(payload) }], structuredContent: payload };
        mcpToolCalls.inc({ tool: toolName, status: 'success', tenant_id: tenantId });
        mcpToolOutputSize.observe({ tool: toolName, tenant_id: tenantId }, JSON.stringify(structured).length);
        timer({ tool: toolName, status: 'success', tenant_id: tenantId });
        return structured;
      };
      try {
        return runWithOptionalSpaceAsync(spaceParam, async () => {
          const searchQuery = queryForSearch(query || '');
          const normalizedQuery = searchQuery.toLowerCase();
          const cacheKey = `begin:v3:${normalizedQuery}:${KAIROS_ENABLE_GROUP_COLLAPSE}:${effectiveLimit}`;

          const cachedResult = await redisCacheService.get(cacheKey);
          if (cachedResult) {
            const parsed = JSON.parse(cachedResult);
            return respond(parsed);
          }

          const candidateMap = await searchAndBuildCandidates(
            memoryStore,
            searchQuery,
            normalizedQuery,
            KAIROS_ENABLE_GROUP_COLLAPSE,
            effectiveLimit
          );

          let headCandidates = Array.from(candidateMap.values()).sort((a, b) => (b.score - a.score));
          if (headCandidates.length > effectiveLimit) {
            headCandidates = headCandidates.slice(0, effectiveLimit);
          }

          const results = headCandidates.length > 0 ? createResults(headCandidates, SCORE_THRESHOLD) : [];
          const output = await generateUnifiedOutput(results, options.qdrantService, {
            refiningUri: REFINING_PROTOCOL_URI,
            refiningNextAction: REFINING_NEXT_ACTION,
            createUri: CREATION_PROTOCOL_URI,
            createNextAction: CREATE_NEXT_ACTION
          });

          await redisCacheService.set(cacheKey, JSON.stringify(output), 300);
          return respond(output);
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'Requested space is not in your allowed spaces') {
          mcpToolCalls.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
          mcpToolErrors.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
          timer({ tool: toolName, status: 'error', tenant_id: tenantId });
          return { content: [{ type: 'text', text: JSON.stringify({ error: 'forbidden', message: error.message }) }], isError: true };
        }
        const ctxErr = getSpaceContextFromStorage();
        structuredLogger.warn(`kairos_search error (returning empty results) space_id=${ctxErr?.defaultWriteSpaceId ?? 'default'}: ${error instanceof Error ? error.message : String(error)}`);
        mcpToolCalls.inc({
          tool: toolName,
          status: 'error',
          tenant_id: tenantId
        });
        mcpToolErrors.inc({
          tool: toolName,
          status: 'error',
          tenant_id: tenantId
        });
        timer({
          tool: toolName,
          status: 'error',
          tenant_id: tenantId
        });
        const fallback = await generateUnifiedOutput([], options.qdrantService, {
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
