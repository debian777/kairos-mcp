import { z } from 'zod';
import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { structuredLogger } from '../utils/structured-logger.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';
import { redisCacheService } from '../services/redis-cache.js';
import { mcpToolCalls, mcpToolDuration, mcpToolErrors, mcpToolInputSize, mcpToolOutputSize } from '../services/metrics/mcp-metrics.js';
import { getTenantId, runWithOptionalSpace, getSpaceContextFromStorage } from '../utils/tenant-context.js';
import type { Memory } from '../types/memory.js';
import { SCORE_THRESHOLD } from '../config.js';
import { resolveFirstStep } from '../services/chain-utils.js';

const CREATION_PROTOCOL_UUID = '00000000-0000-0000-0000-000000002001';
const CREATION_PROTOCOL_URI = `kairos://mem/${CREATION_PROTOCOL_UUID}`;
const REFINING_PROTOCOL_UUID = '00000000-0000-0000-0000-000000002002';
const REFINING_PROTOCOL_URI = `kairos://mem/${REFINING_PROTOCOL_UUID}`;

interface RegisterSearchOptions {
  toolName?: string;
  qdrantService?: QdrantService;
}

interface Candidate {
  memory: Memory;
  score: number;
  uri: string;
  label: string;
  tags: string[];
  total_steps: number;
}

interface UnifiedChoice {
  uri: string;
  label: string;
  chain_label: string | null;
  score: number | null;
  role: 'match' | 'refine' | 'create';
  tags: string[];
  next_action: string;
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

  if (normalizedQuery === 'ai coding rules') {
    structuredLogger.warn(`[search-debug] initial results=${memories.length} uniqueChains=${candidateMap.size} enableCollapse=${enableGroupCollapse}`);
  }

  if (candidateMap.size < 10 && enableGroupCollapse) {
    const { memories: moreMemories, scores: moreScores } = await memoryStore.searchMemories(query, 80, false);
    moreMemories.forEach((memory, idx) => addCandidate(candidateMap, memory, moreScores[idx] ?? 0));
    if (normalizedQuery === 'ai coding rules') {
      structuredLogger.warn(`[search-debug] after fallback uniqueChains=${candidateMap.size}`);
    }
  }

  return candidateMap;
}

function createResults(headCandidates: Array<{ memory: Memory; score: number }>): Candidate[] {
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

async function resolveHead(
  memory: Memory,
  qdrantService?: QdrantService
): Promise<{ uri: string; label: string }> {
  const head = (await resolveFirstStep(memory, qdrantService)) ?? {
    uri: `kairos://mem/${memory.memory_uuid}`,
    label: memory.label
  };
  return head;
}

const REFINING_NEXT_ACTION = `call kairos_begin with ${REFINING_PROTOCOL_URI} to get step-by-step help turning the user's request into a better search query`;
const CREATE_NEXT_ACTION = `call kairos_begin with ${CREATION_PROTOCOL_URI} to create a new protocol`;

async function generateUnifiedOutput(
  results: Candidate[],
  qdrantService?: QdrantService
): Promise<any> {
  const choices: UnifiedChoice[] = [];
  const matchCount = results.length;

  // Build match choices with per-choice next_action
  for (const result of results) {
    const head = await resolveHead(result.memory, qdrantService);
    choices.push({
      uri: head.uri,
      label: head.label || result.label,
      chain_label: result.memory.chain?.label || null,
      score: result.score,
      role: 'match',
      tags: result.tags,
      next_action: `call kairos_begin with ${head.uri} to execute this protocol`
    });
  }

  // Single match: only that choice. Zero or multiple: append refine + create.
  if (matchCount !== 1) {
    choices.push(
      {
        uri: REFINING_PROTOCOL_URI,
        label: 'Get help refining your search',
        chain_label: 'Run protocol to turn vague user request into a better kairos_search query',
        score: null,
        role: 'refine',
        tags: ['meta', 'refine'],
        next_action: REFINING_NEXT_ACTION
      },
      {
        uri: CREATION_PROTOCOL_URI,
        label: 'Create New KAIROS Protocol Chain',
        chain_label: 'Create New KAIROS Protocol Chain',
        score: null,
        role: 'create',
        tags: ['meta', 'creation'],
        next_action: CREATE_NEXT_ACTION
      }
    );
  }

  let message: string;
  let nextAction: string;

  if (matchCount === 0) {
    message = 'No existing protocol matched your query. Refine your search or create a new one.';
    nextAction = "Pick one choice and follow that choice's next_action.";
  } else if (matchCount === 1) {
    message = 'Found 1 match.';
    nextAction = "Follow the choice's next_action.";
  } else {
    const topMatch = choices[0]!;
    const confidencePercent = Math.round((topMatch.score || 0) * 100);
    message = `Found ${matchCount} matches (top confidence: ${confidencePercent}%). Choose one, refine your search, or create a new protocol.`;
    nextAction = "Pick one choice and follow that choice's next_action.";
  }

  return {
    must_obey: true,
    message,
    next_action: nextAction,
    choices
  };
}

/**
 * Register kairos_search tool
 * 
 * V2 unified response: always must_obey: true, choices array with score/role,
 * creation protocol always available as fallback.
 */
export function registerSearchTool(server: any, memoryStore: MemoryQdrantStore, options: RegisterSearchOptions = {}) {
  const toolName = options.toolName || 'kairos_search';
  const memoryUriSchema = z
    .string()
    .regex(/^kairos:\/\/mem\/[0-9a-f-]{36}$/i, 'must match kairos://mem/{uuid}');
  const choiceUriSchema = memoryUriSchema;

  const inputSchema = z.object({
    query: z.string().min(1).describe('Search query for chain heads'),
    space: z.string().optional().describe('Scope results to this space (must be in your allowed spaces)'),
    space_id: z.string().optional().describe('Alias for space')
  });

  const outputSchema = z.object({
    must_obey: z.boolean().describe('Always true. Follow next_action.'),
    message: z.string().describe('Human-readable summary'),
    next_action: z.string().describe("Global directive: pick one choice and follow that choice's next_action."),
    choices: z.array(z.object({
      uri: choiceUriSchema,
      label: z.string(),
      chain_label: z.string().nullable(),
      score: z.number().nullable().describe('0.0-1.0 for matches, null for refine/create'),
      role: z.enum(['match', 'refine', 'create']).describe('match = search result, refine = search again, create = system action'),
      tags: z.array(z.string()),
      next_action: z.string().describe('Instruction for this choice: call kairos_begin with this choice\'s uri.')
    })).describe('Options: match(es) first, then refine (if present), then create (if present).')
  });

  structuredLogger.debug(`kairos_search registration inputSchema: ${JSON.stringify(inputSchema)}`);
  structuredLogger.debug(`kairos_search registration outputSchema: ${JSON.stringify(outputSchema)}`);
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
      const ctxBefore = getSpaceContextFromStorage();
      structuredLogger.debug(`kairos_search query="${(query || '').slice(0, 60)}" space_param=${spaceParam ?? 'none'} space_effective=${ctxBefore?.defaultWriteSpaceId ?? 'default'}`);
      const inputSize = JSON.stringify({ query }).length;
      mcpToolInputSize.observe({ tool: toolName, tenant_id: tenantId }, inputSize);

      const timer = mcpToolDuration.startTimer({
        tool: toolName,
        tenant_id: tenantId
      });
      const respond = (payload: any) => {
        const structured = {
          content: [{
            type: 'text', text: JSON.stringify(payload)
          }],
          structuredContent: payload
        };
        mcpToolCalls.inc({ 
          tool: toolName, 
          status: 'success',
          tenant_id: tenantId 
        });
        const outputSize = JSON.stringify(structured).length;
        mcpToolOutputSize.observe({ tool: toolName, tenant_id: tenantId }, outputSize);
        timer({ 
          tool: toolName, 
          status: 'success',
          tenant_id: tenantId 
        });
        return structured;
      };
      try {
        return runWithOptionalSpace(spaceParam, async () => {
          const normalizedQuery = (query || '').trim().toLowerCase();
          const ctxInCallback = getSpaceContextFromStorage();
          structuredLogger.debug(`kairos_search executing space_id=${ctxInCallback?.defaultWriteSpaceId ?? 'default'}`);
          const parseEnvBool = (name: string, defaultVal: boolean) => {
            const v = process.env[name];
            if (v === undefined) return defaultVal;
            const low = String(v).toLowerCase();
            return !(low === 'false' || low === '0' || low === 'no' || low === 'n');
          };

          const enableGroupCollapse = parseEnvBool('KAIROS_ENABLE_GROUP_COLLAPSE', true);
          const cacheKey = `begin:v3:${normalizedQuery}:${enableGroupCollapse}`;

          const cachedResult = await redisCacheService.get(cacheKey);
          if (cachedResult) {
            const parsed = JSON.parse(cachedResult);
            return respond(parsed);
          }

          const candidateMap = await searchAndBuildCandidates(
            memoryStore,
            query,
            normalizedQuery,
            enableGroupCollapse
          );

          let headCandidates = Array.from(candidateMap.values())
            .sort((a, b) => (b.score - a.score));

          if (headCandidates.length > 10) {
            headCandidates = headCandidates.slice(0, 10);
          }

          const results = headCandidates.length > 0 ? createResults(headCandidates) : [];
          const output = await generateUnifiedOutput(results, options.qdrantService);

          await redisCacheService.set(cacheKey, JSON.stringify(output), 300);
          return respond(output);
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'Requested space is not in your allowed spaces') {
          mcpToolCalls.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
          mcpToolErrors.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
          timer({ tool: toolName, status: 'error', tenant_id: tenantId });
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: 'forbidden', message: error.message }) }],
            isError: true
          };
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
        const fallback = await generateUnifiedOutput([], options.qdrantService);
        return respond(fallback);
      }
    }
  );
}
