import { z } from 'zod';
import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { QdrantService } from '../services/qdrant/service.js';
import type { Memory } from '../types/memory.js';
import { structuredLogger } from '../utils/structured-logger.js';
import { resolveFirstStep as resolveChainFirstStep } from '../services/chain-utils.js';
import { redisCacheService } from '../services/redis-cache.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';
import { SCORE_THRESHOLD } from '../config.js';
import { mcpToolCalls, mcpToolDuration, mcpToolErrors, mcpToolInputSize, mcpToolOutputSize } from '../services/metrics/mcp-metrics.js';
import { getTenantId } from '../utils/tenant-context.js';

interface RegisterBeginOptions {
  toolName?: string;
  qdrantService?: QdrantService;
}

export function registerBeginTool(server: any, memoryStore: MemoryQdrantStore, options: RegisterBeginOptions = {}) {
  const toolName = options.toolName || 'kairos_begin';
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

  structuredLogger.debug(`kairos_begin registration inputSchema: ${JSON.stringify(inputSchema)}`);
  structuredLogger.debug(`kairos_begin registration outputSchema: ${JSON.stringify(outputSchema)}`);
  server.registerTool(
    toolName,
    {
      title: 'Find chain heads',
      description: getToolDoc('kairos_begin'),
      inputSchema,
      outputSchema
    },
    async (params: any) => {
      const tenantId = getTenantId();
      const inputSize = JSON.stringify(params).length;
      mcpToolInputSize.observe({ tool: toolName, tenant_id: tenantId }, inputSize);
      
      const timer = mcpToolDuration.startTimer({ 
        tool: toolName,
        tenant_id: tenantId 
      });
      
      let result: any;
      
      try {
        const { query } = params as { query: string };
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
        result = {
          content: [{
            type: 'text', text: JSON.stringify(parsed)
          }],
          structuredContent: parsed
        };
        
        mcpToolCalls.inc({ 
          tool: toolName, 
          status: 'success',
          tenant_id: tenantId 
        });
        
        const outputSize = JSON.stringify(result).length;
        mcpToolOutputSize.observe({ tool: toolName, tenant_id: tenantId }, outputSize);
        
        timer({ 
          tool: toolName, 
          status: 'success',
          tenant_id: tenantId 
        });
        
        return result;
      }

      // Cache miss - perform search
      const { memories, scores } = await memoryStore.searchMemories(query, 40, enableGroupCollapse);

      // Filter to only chain heads (position=1)
      const headMemories: Memory[] = [];
      const headScores: number[] = [];
      for (let i = 0; i < memories.length; i++) {
        const m = memories[i]!;
        if (m.chain && m.chain.step_index === 1) {
          headMemories.push(m);
          headScores.push(scores[i] ?? 0);
        }
      }

      // If not enough heads, try without collapse to find more
      if (headMemories.length < 10 && enableGroupCollapse) {
        const { memories: moreMemories, scores: moreScores } = await memoryStore.searchMemories(query, 80, false);
        for (let i = 0; i < moreMemories.length; i++) {
          const m = moreMemories[i]!;
          if (m.chain && m.chain.step_index === 1 && !headMemories.some(h => h.memory_uuid === m.memory_uuid)) {
            headMemories.push(m);
            headScores.push(moreScores[i] ?? 0);
          }
        }
      }

      // Trim to 10 results
      if (headMemories.length > 10) {
        headMemories.splice(10);
        headScores.splice(10);
      }

      if (headMemories.length === 0) {
        // CASE 4 — GIBBERISH / NO RESULTS
        // Must not hallucinate — ask for clarification or mint
        const output = {
          must_obey: false,
          protocol_status: "no_protocol",
          message: "I couldn't find any relevant protocol for your request.",
          suggestion: "Would you like to create a new one?"
        };
        result = {
          content: [{
            type: 'text', text: JSON.stringify(output)
          }],
          structuredContent: output
        };
        
        mcpToolCalls.inc({ 
          tool: toolName, 
          status: 'success',
          tenant_id: tenantId 
        });
        
        const outputSize = JSON.stringify(result).length;
        mcpToolOutputSize.observe({ tool: toolName, tenant_id: tenantId }, outputSize);
        
        timer({ 
          tool: toolName, 
          status: 'success',
          tenant_id: tenantId 
        });
        
        return result;
      }

      // Create results array with memory + score pairs
      // Filter out results below score_threshold before processing
      const results = headMemories
        .map((memory, index) => ({
          memory,
          score: headScores[index] ?? 0,
          uri: `kairos://mem/${memory.memory_uuid}`,
          label: memory.label,
          tags: memory.tags || [],
          total_steps: memory.chain?.step_count || 1
        }))
        .filter(r => r.score >= SCORE_THRESHOLD);

      // If no results after filtering by score_threshold, return no_protocol
      // DO NOT cache negative results - they become stale immediately when new chains are minted
      if (results.length === 0) {
        const output = {
          must_obey: false,
          protocol_status: "no_protocol",
          message: "I couldn't find any relevant protocol for your request.",
          suggestion: "Would you like to create a new one?"
        };
        // No caching of negative results
        result = {
          content: [{
            type: 'text', text: JSON.stringify(output)
          }],
          structuredContent: output
        };
        
        mcpToolCalls.inc({ 
          tool: toolName, 
          status: 'success',
          tenant_id: tenantId 
        });
        
        const outputSize = JSON.stringify(result).length;
        mcpToolOutputSize.observe({ tool: toolName, tenant_id: tenantId }, outputSize);
        
        timer({ 
          tool: toolName, 
          status: 'success',
          tenant_id: tenantId 
        });
        
        return result;
      }

      // Filter for perfect matches (score >= 1.0, always)
      const perfectMatches = results.filter(r => r.score >= 1.0);

      let output: any;

      if (perfectMatches.length === 1) {
        // SINGLE PERFECT MATCH → obedience mode
        const match = perfectMatches[0]!;
        const head = (await resolveChainFirstStep(match.memory, options.qdrantService)) ?? { uri: match.uri, label: match.label };
        output = {
          must_obey: true,
          start_here: head.uri,
          chain_label: match.memory.chain?.label || null,
          total_steps: match.total_steps,
          protocol_status: "initiated"
        };
      } else if (perfectMatches.length > 1) {
        // MULTIPLE PERFECT MATCHES → positive choice mode
        // Resolve chain first step for each perfect match
        const resolvedHeads = await Promise.all(perfectMatches.map(async (match) => {
          const head = (await resolveChainFirstStep(match.memory, options.qdrantService)) ?? { uri: match.uri, label: match.label };
          return {
            uri: head.uri,
            label: head.label || match.label,
            chain_label: match.memory.chain?.label || null,
            tags: match.tags
          };
        }));
        output = {
          must_obey: false,
          multiple_perfect_matches: perfectMatches.length,
          message: `Great! We have ${perfectMatches.length} canonical protocols that perfectly match your request. Which one would you like to use?`,
          choices: resolvedHeads,
          protocol_status: "initiated"
        };
      } else {
        // CASE 3 — NO PERFECT MATCH (top score < 1.0)
        // Must not force execution — respond with best effort + confidence hint
        const topResult = results[0]!;
        const head = (await resolveChainFirstStep(topResult.memory, options.qdrantService)) ?? { uri: topResult.uri, label: topResult.label };
        const confidencePercent = Math.round((topResult.score || 0) * 100);
        output = {
          must_obey: false,
          protocol_status: "partial_match",
          best_match: {
            uri: head.uri,
            label: head.label || topResult.label,
            chain_label: topResult.memory.chain?.label || null,
            score: topResult.score || 0,
            total_steps: topResult.total_steps
          },
          message: `I found a relevant protocol (confidence: ${confidencePercent}%). Shall I proceed?`,
          hint: "Or would you like to create a new canonical one?"
        };
      }

      // Cache the result (simplified)
      await redisCacheService.set(cacheKey, JSON.stringify(output), 300); // 5 min cache

      result = {
        content: [{
          type: 'text', text: JSON.stringify(output)
        }],
        structuredContent: output
      };
      
      mcpToolCalls.inc({ 
        tool: toolName, 
        status: 'success',
        tenant_id: tenantId 
      });
      
      const outputSize = JSON.stringify(result).length;
      mcpToolOutputSize.observe({ tool: toolName, tenant_id: tenantId }, outputSize);
      
      timer({ 
        tool: toolName, 
        status: 'success',
        tenant_id: tenantId 
      });
      
      return result;
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