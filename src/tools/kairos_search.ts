import { z } from 'zod';
import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { structuredLogger } from '../utils/structured-logger.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';
import { redisCacheService } from '../services/redis-cache.js';
import { mcpToolCalls, mcpToolDuration, mcpToolErrors, mcpToolInputSize, mcpToolOutputSize } from '../services/metrics/mcp-metrics.js';
import { getTenantId, runWithOptionalSpaceAsync, getSpaceContextFromStorage } from '../utils/tenant-context.js';
import { executeSearch } from '../services/kairos-orchestration.js';

interface RegisterSearchOptions {
  toolName?: string;
  qdrantService?: QdrantService;
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
      next_action: z.string().describe('Instruction for this choice: call kairos_begin with this choice\'s uri.'),
      protocol_version: z.string().nullable().describe('Stored protocol version (e.g. semver) for match choices; null for refine/create. Compare with skill-bundled protocol to decide if re-mint is needed.')
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
        return runWithOptionalSpaceAsync(spaceParam, async () => {
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

          const output = await executeSearch(memoryStore, query || '', {
            qdrantService: options.qdrantService,
            enableGroupCollapse
          });
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
        const fallback = await executeSearch(memoryStore, '', { qdrantService: options.qdrantService });
        return respond(fallback);
      }
    }
  );
}
