import { z } from 'zod';
import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { structuredLogger } from '../utils/structured-logger.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';
import { redisCacheService } from '../services/redis-cache.js';
import { mcpToolCalls, mcpToolDuration, mcpToolErrors, mcpToolInputSize, mcpToolOutputSize } from '../services/metrics/mcp-metrics.js';
import { getTenantId } from '../utils/tenant-context.js';
import type { Memory } from '../types/memory.js';
import { SCORE_THRESHOLD } from '../config.js';
import { resolveFirstStep } from '../services/chain-utils.js';

const CREATION_PROTOCOL_UUID = '00000000-0000-0000-0000-000000002001';
const CREATION_PROTOCOL_URI = `kairos://mem/${CREATION_PROTOCOL_UUID}`;

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
  role: 'match' | 'create';
  tags: string[];
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

async function generateUnifiedOutput(
  results: Candidate[],
  qdrantService?: QdrantService
): Promise<any> {
  const choices: UnifiedChoice[] = [];

  // Resolve heads for all results and build choices
  for (const result of results) {
    const head = await resolveHead(result.memory, qdrantService);
    choices.push({
      uri: head.uri,
      label: head.label || result.label,
      chain_label: result.memory.chain?.label || null,
      score: result.score,
      role: 'match',
      tags: result.tags
    });
  }

  // Always append creation protocol as fallback
  choices.push({
    uri: CREATION_PROTOCOL_URI,
    label: 'Create New KAIROS Protocol Chain',
    chain_label: 'Create New KAIROS Protocol Chain',
    score: null,
    role: 'create',
    tags: ['system', 'create', 'mint']
  });

  const matchCount = results.length;
  let message: string;
  let nextAction: string;

  if (matchCount === 0) {
    message = "No existing protocol matched your query. You can create a new one.";
    nextAction = `call kairos_begin with ${CREATION_PROTOCOL_URI} to create a new protocol`;
  } else if (matchCount === 1) {
    const topChoice = choices[0]!;
    message = 'Found 1 match.';
    nextAction = `call kairos_begin with ${topChoice.uri} to execute protocol`;
  } else {
    const topMatch = choices[0]!;
    const confidencePercent = Math.round((topMatch.score || 0) * 100);
    message = `Found ${matchCount} matches (top confidence: ${confidencePercent}%). Choose one or create a new protocol.`;
    nextAction = `call kairos_begin with ${topMatch.uri} to execute best match, or choose another from choices`;
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

  const inputSchema = z.object({
    query: z.string().min(1).describe('Search query for chain heads')
  });

  const outputSchema = z.object({
    must_obey: z.boolean().describe('Always true. Follow next_action.'),
    message: z.string().describe('Human-readable summary'),
    next_action: z.string().describe('Next tool call instruction with embedded URI'),
    choices: z.array(z.object({
      uri: memoryUriSchema,
      label: z.string(),
      chain_label: z.string().nullable(),
      score: z.number().nullable().describe('0.0-1.0 for matches, null for system actions'),
      role: z.enum(['match', 'create']).describe('match = search result, create = system action'),
      tags: z.array(z.string())
    })).describe('Protocols to choose from. Last entry is always the creation protocol.')
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
      const { query } = params as { query: string };
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
      } catch (error) {
        structuredLogger.warn(`kairos_search error (returning empty results): ${error instanceof Error ? error.message : String(error)}`);
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
