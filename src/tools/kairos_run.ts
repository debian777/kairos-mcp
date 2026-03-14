import { z } from 'zod';
import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { structuredLogger } from '../utils/structured-logger.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';
import { mcpToolCalls, mcpToolDuration, mcpToolErrors, mcpToolInputSize, mcpToolOutputSize } from '../services/metrics/mcp-metrics.js';
import { getTenantId, runWithOptionalSpaceAsync } from '../utils/tenant-context.js';
import {
  executeSearch,
  executeBegin,
  selectRunTarget
} from '../services/kairos-orchestration.js';

interface RegisterKairosRunOptions {
  toolName?: string;
  qdrantService?: QdrantService | undefined;
}

/**
 * Register kairos_run tool.
 * Canonical natural-language entrypoint: raw user message -> search -> one strong match ? begin that : begin refine.
 */
export function registerKairosRunTool(server: any, memoryStore: MemoryQdrantStore, options: RegisterKairosRunOptions = {}) {
  const toolName = options.toolName ?? 'kairos_run';
  const memoryUriSchema = z.string().regex(/^kairos:\/\/mem\/[0-9a-f-]{36}$/i, 'must match kairos://mem/{uuid}');

  const inputSchema = z.object({
    message: z.string().min(1).describe('Raw user message or intent phrase to run a workflow'),
    space: z.string().optional().describe('Scope to this space (must be in your allowed spaces)'),
    space_id: z.string().optional().describe('Alias for space')
  });

  const outputSchema = z.object({
    must_obey: z.boolean(),
    routing: z.object({
      decision: z.enum(['direct_match', 'refine_ambiguous', 'refine_no_match', 'refine_weak_match']),
      selected_uri: memoryUriSchema,
      selected_label: z.string(),
      selected_role: z.enum(['match', 'refine', 'create']),
      selected_score: z.number().nullable(),
      protocol_version: z.string().nullable()
    }),
    current_step: z.object({
      uri: memoryUriSchema,
      content: z.string(),
      mimeType: z.literal('text/markdown')
    }),
    challenge: z.record(z.string(), z.unknown()),
    next_action: z.string(),
    message: z.string().optional()
  });

  server.registerTool(
    toolName,
    {
      title: 'Run workflow from user message',
      description: getToolDoc('kairos_run') ?? 'Start a KAIROS run from raw user intent. Pass the user\'s message; server searches and begins the best match or the refine protocol. Then follow next_action (kairos_next loop then kairos_attest).',
      inputSchema,
      outputSchema
    },
    async (params: any) => {
      const tenantId = getTenantId();
      const { message, space, space_id } = params as { message: string; space?: string; space_id?: string };
      const spaceParam = space ?? space_id;
      structuredLogger.debug(`kairos_run message="${(message ?? '').slice(0, 80)}" space_param=${spaceParam ?? 'none'}`);
      const inputSize = JSON.stringify({ message }).length;
      mcpToolInputSize.observe({ tool: toolName, tenant_id: tenantId }, inputSize);

      const timer = mcpToolDuration.startTimer({ tool: toolName, tenant_id: tenantId });
      const respond = (payload: any) => {
        const structured = {
          content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
          structuredContent: payload
        };
        mcpToolCalls.inc({ tool: toolName, status: 'success', tenant_id: tenantId });
        mcpToolOutputSize.observe({ tool: toolName, tenant_id: tenantId }, JSON.stringify(structured).length);
        timer({ tool: toolName, status: 'success', tenant_id: tenantId });
        return structured;
      };

      try {
        return await runWithOptionalSpaceAsync(spaceParam, async () => {
          const parseEnvBool = (name: string, defaultVal: boolean) => {
            const v = process.env[name];
            if (v === undefined) return defaultVal;
            const low = String(v).toLowerCase();
            return !(low === 'false' || low === '0' || low === 'no' || low === 'n');
          };
          const enableGroupCollapse = parseEnvBool('KAIROS_ENABLE_GROUP_COLLAPSE', true);

          const searchOutput = await executeSearch(memoryStore, message ?? '', {
            qdrantService: options.qdrantService,
            enableGroupCollapse
          });

          const { uri: selectedUri, choice: selectedChoice, decision } = selectRunTarget(searchOutput.choices);
          const beginPayload = await executeBegin(memoryStore, selectedUri, {
            qdrantService: options.qdrantService
          });

          const output = {
            ...beginPayload,
            routing: {
              decision,
              selected_uri: selectedChoice.uri,
              selected_label: selectedChoice.label,
              selected_role: selectedChoice.role,
              selected_score: selectedChoice.score ?? null,
              protocol_version: selectedChoice.protocol_version ?? null
            }
          };
          return respond(output);
        });
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
        structuredLogger.warn(`kairos_run error: ${error instanceof Error ? error.message : String(error)}`);
        mcpToolCalls.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
        mcpToolErrors.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
        timer({ tool: toolName, status: 'error', tenant_id: tenantId });
        throw error;
      }
    }
  );
}
