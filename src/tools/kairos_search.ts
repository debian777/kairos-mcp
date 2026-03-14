import { z } from 'zod';
import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { structuredLogger } from '../utils/structured-logger.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';
import { redisCacheService } from '../services/redis-cache.js';
import { mcpToolCalls, mcpToolDuration, mcpToolErrors, mcpToolInputSize, mcpToolOutputSize } from '../services/metrics/mcp-metrics.js';
import { getTenantId, runWithOptionalSpaceAsync } from '../utils/tenant-context.js';
import type { Memory } from '../types/memory.js';
import { SCORE_THRESHOLD } from '../config.js';
import { generateUnifiedOutput } from './kairos_search_output.js';
import type { SearchCandidate } from './kairos_search_output.js';

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
  enableGroupCollapse: boolean
): Promise<Map<string, { memory: Memory; score: number }>> {
  const candidateMap = new Map<string, { memory: Memory; score: number }>();
  const { memories, scores } = await memoryStore.searchMemories(query, 40, enableGroupCollapse);
  memories.forEach((memory, idx) => addCandidate(candidateMap, memory, scores[idx] ?? 0));
  if (candidateMap.size < 10 && enableGroupCollapse) {
    const { memories: moreMemories, scores: moreScores } = await memoryStore.searchMemories(query, 80, false);
    moreMemories.forEach((memory, idx) => addCandidate(candidateMap, memory, moreScores[idx] ?? 0));
  }
  return candidateMap;
}

function createResults(headCandidates: Array<{ memory: Memory; score: number }>): SearchCandidate[] {
  return headCandidates
    .map(({ memory, score }) => ({
      memory,
      score,
      uri: `kairos://mem/${memory.memory_uuid}`,
      label: memory.label,
      tags: memory.tags || [],
      total_steps: memory.chain?.step_count || 1
    }))
    .filter(r => r.score >= SCORE_THRESHOLD);
}

/** Register kairos_search tool. V2: must_obey true, choices with best action at index 0. */
export function registerSearchTool(server: any, memoryStore: MemoryQdrantStore, options: RegisterSearchOptions = {}) {
  const toolName = options.toolName || 'kairos_search';
  const memoryUriSchema = z.string().regex(/^kairos:\/\/mem\/[0-9a-f-]{36}$/i, 'must match kairos://mem/{uuid}');
  const inputSchema = z.object({
    query: z.string().min(1).describe('Search query for chain heads'),
    space: z.string().optional().describe('Scope results to this space (must be in your allowed spaces)'),
    space_id: z.string().optional().describe('Alias for space')
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
      const { query, space, space_id } = params as { query: string; space?: string; space_id?: string };
      const spaceParam = space ?? space_id;
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
          const normalizedQuery = (query || '').trim().toLowerCase();
          const parseEnvBool = (name: string, defaultVal: boolean) => {
            const v = process.env[name];
            if (v === undefined) return defaultVal;
            const low = String(v).toLowerCase();
            return !(low === 'false' || low === '0' || low === 'no' || low === 'n');
          };
          const enableGroupCollapse = parseEnvBool('KAIROS_ENABLE_GROUP_COLLAPSE', true);
          const cacheKey = `begin:v3:${normalizedQuery}:${enableGroupCollapse}`;
          const cachedResult = await redisCacheService.get(cacheKey);
          if (cachedResult) return respond(JSON.parse(cachedResult));

          const candidateMap = await searchAndBuildCandidates(memoryStore, query || '', normalizedQuery, enableGroupCollapse);
          let headCandidates = Array.from(candidateMap.values()).sort((a, b) => b.score - a.score);
          if (headCandidates.length > 10) headCandidates = headCandidates.slice(0, 10);
          const results = headCandidates.length > 0 ? createResults(headCandidates) : [];
          const output = await generateUnifiedOutput(results, normalizedQuery, options.qdrantService);
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
        structuredLogger.warn(`kairos_search error (returning empty results): ${error instanceof Error ? error.message : String(error)}`);
        mcpToolCalls.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
        mcpToolErrors.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
        timer({ tool: toolName, status: 'error', tenant_id: tenantId });
        const fallbackQuery = (params as { query?: string }).query ?? '';
        return respond(await generateUnifiedOutput([], fallbackQuery.trim().toLowerCase(), options.qdrantService));
      }
    }
  );
}
