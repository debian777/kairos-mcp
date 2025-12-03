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

  // Initial search
  const { memories, scores } = await memoryStore.searchMemories(query, 40, enableGroupCollapse);
  memories.forEach((memory, idx) => addCandidate(candidateMap, memory, scores[idx] ?? 0));

  if (normalizedQuery === 'ai coding rules') {
    structuredLogger.warn(`[search-debug] initial results=${memories.length} uniqueChains=${candidateMap.size} enableCollapse=${enableGroupCollapse}`);
  }

  // If not enough unique chains, try without collapse to find more
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

async function generateSinglePerfectMatchOutput(
  match: Candidate,
  qdrantService?: QdrantService
): Promise<any> {
  const head = await resolveHead(match.memory, qdrantService);
  return {
    must_obey: true,
    start_here: head.uri,
    chain_label: match.memory.chain?.label || null,
    total_steps: match.total_steps,
    protocol_status: 'initiated'
  };
}

async function generateMultiplePerfectMatchesOutput(
  perfectMatches: Candidate[],
  qdrantService?: QdrantService
): Promise<any> {
  const resolvedHeads = await Promise.all(perfectMatches.map(async (match) => {
    const head = await resolveHead(match.memory, qdrantService);
    return {
      uri: head.uri,
      label: head.label || match.label,
      chain_label: match.memory.chain?.label || null,
      tags: match.tags
    };
  }));
  return {
    must_obey: false,
    multiple_perfect_matches: perfectMatches.length,
    message: `Great! We have ${perfectMatches.length} canonical protocols that perfectly match your request. Which one would you like to use?`,
    choices: resolvedHeads,
    protocol_status: 'initiated'
  };
}

async function generatePartialMatchOutput(
  topResult: Candidate,
  qdrantService?: QdrantService
): Promise<any> {
  const head = await resolveHead(topResult.memory, qdrantService);
  const confidencePercent = Math.round((topResult.score || 0) * 100);
  return {
    must_obey: false,
    protocol_status: 'partial_match',
    best_match: {
      uri: head.uri,
      label: head.label || topResult.label,
      chain_label: topResult.memory.chain?.label || null,
      score: topResult.score || 0,
      total_steps: topResult.total_steps
    },
    message: `I found a relevant protocol (confidence: ${confidencePercent}%). Shall I proceed?`,
    hint: 'Or would you like to create a new canonical one?'
  };
}

function generateNoResultsOutput(): any {
  return {
    must_obey: false,
    protocol_status: 'no_protocol',
    message: "I couldn't find any relevant protocol for your request.",
    suggestion: "Would you like to create a new one?"
  };
}

/**
 * Register kairos_search tool
 * This tool searches for protocol chains and returns chain heads.
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
    must_obey: z.boolean(),
    start_here: memoryUriSchema.optional().nullable(),
    chain_label: z.string().optional().nullable(),
    total_steps: z.number().optional().nullable(),
    protocol_status: z.string(),
    multiple_perfect_matches: z.number().optional().nullable(),
    message: z.string().optional().nullable(),
    suggestion: z.string().optional().nullable(),
    hint: z.string().optional().nullable(),
    best_match: z.object({
      uri: memoryUriSchema,
      label: z.string(),
      chain_label: z.string().optional().nullable(),
      score: z.number(),
      total_steps: z.number()
    }).optional().nullable(),
    choices: z.array(z.object({
      uri: memoryUriSchema,
      label: z.string(),
      chain_label: z.string().optional().nullable(),
      tags: z.array(z.string()).optional()
    })).optional().nullable()
  });

  structuredLogger.debug(`kairos_search registration inputSchema: ${JSON.stringify(inputSchema)}`);
  structuredLogger.debug(`kairos_search registration outputSchema: ${JSON.stringify(outputSchema)}`);
  server.registerTool(
    toolName,
    {
      title: 'Search for protocol chains',
      description: getToolDoc('kairos_search') || 'Search for protocol chains matching the query',
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

        // Check cache first
        const parseEnvBool = (name: string, defaultVal: boolean) => {
          const v = process.env[name];
          if (v === undefined) return defaultVal;
          const low = String(v).toLowerCase();
          return !(low === 'false' || low === '0' || low === 'no' || low === 'n');
        };

        const enableGroupCollapse = parseEnvBool('KAIROS_ENABLE_GROUP_COLLAPSE', true);
        const cacheKey = `begin:v2:${normalizedQuery}:${enableGroupCollapse}`;

        const cachedResult = await redisCacheService.get(cacheKey);
        if (cachedResult) {
          const parsed = JSON.parse(cachedResult);
          return respond(parsed);
        }

        // Cache miss - perform search
        const candidateMap = await searchAndBuildCandidates(
          memoryStore,
          query,
          normalizedQuery,
          enableGroupCollapse
        );

        let headCandidates = Array.from(candidateMap.values())
          .sort((a, b) => (b.score - a.score));

        // Trim to 10 results
        if (headCandidates.length > 10) {
          headCandidates = headCandidates.slice(0, 10);
        }

        if (headCandidates.length === 0) {
          const output = generateNoResultsOutput();
          await redisCacheService.set(cacheKey, JSON.stringify(output), 300);
          return respond(output);
        }

        const results = createResults(headCandidates);
        const perfectMatches = results.filter(r => r.score >= 1.0);
        const topResult = results[0];

        let output: any;
        if (perfectMatches.length === 1) {
          output = await generateSinglePerfectMatchOutput(perfectMatches[0]!, options.qdrantService);
        } else if (perfectMatches.length > 1) {
          output = await generateMultiplePerfectMatchesOutput(perfectMatches, options.qdrantService);
        } else if (topResult) {
          output = await generatePartialMatchOutput(topResult, options.qdrantService);
        } else {
          output = generateNoResultsOutput();
        }

        await redisCacheService.set(cacheKey, JSON.stringify(output), 300);
        return respond(output);
      } catch (error) {
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
        throw error;
      }
    }
  );
}
