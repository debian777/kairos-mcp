import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { Memory } from '../types/memory.js';
import { logger } from '../utils/structured-logger.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';
import { mcpToolCalls, mcpToolDuration, mcpToolErrors, mcpToolInputSize, mcpToolOutputSize, kairosMintSimilarMemoryFound } from '../services/metrics/mcp-metrics.js';
import { getTenantId, getSpaceContextFromStorage, runWithSpaceContextAsync } from '../utils/tenant-context.js';
import { KAIROS_APP_SPACE_DISPLAY_NAME } from '../utils/space-display.js';
import { validateProtocolStructure, CREATION_PROTOCOL_URI } from '../services/memory/validate-protocol-structure.js';
import { mintInputSchema, mintOutputSchema, type MintInput, type MintOutput } from './kairos_mint_schema.js';
import { KairosError } from '../types/index.js';

/** Thrown by executeMint on validation or store errors. */
export class MintError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'MintError';
  }
}

/**
 * Shared execute: validate and store markdown chain. Used by MCP tool and HTTP route.
 * @param runStore Runs the store call (e.g. with space context). Signature: (fn: () => Promise<Memory[]>) => Promise<Memory[]>
 */
export async function executeMint(
  memoryStore: MemoryQdrantStore,
  input: MintInput,
  runStore: (fn: () => Promise<Memory[]>) => Promise<Memory[]>
): Promise<MintOutput> {
  const validation = validateProtocolStructure(input.markdown_doc);
  if (!validation.valid) {
    throw new MintError('PROTOCOL_STRUCTURE_INVALID', validation.message, {
      missing: validation.missing,
      must_obey: true,
      next_action: `call kairos_begin with ${CREATION_PROTOCOL_URI} for guided protocol creation`
    });
  }
  const memories = await runStore(() =>
    memoryStore.storeChain([input.markdown_doc], input.llm_model_id, {
      forceUpdate: !!input.force_update,
      ...(input.protocol_version && { protocolVersion: input.protocol_version })
    })
  );
  return {
    items: memories.map((memory) => ({
      uri: `kairos://mem/${memory.memory_uuid}`,
      memory_uuid: memory.memory_uuid,
      label: memory.label,
      tags: memory.tags
    })),
    status: 'stored'
  };
}

interface RegisterKairosMintOptions {
  toolName?: string;
}

export function registerKairosMintTool(server: any, memoryStore: MemoryQdrantStore, options: RegisterKairosMintOptions = {}) {
  const toolName = options.toolName || 'kairos_mint';
  logger.debug(`kairos_mint registration inputSchema: ${JSON.stringify(mintInputSchema)}`);
  logger.debug(`kairos_mint registration outputSchema: ${JSON.stringify(mintOutputSchema)}`);
  server.registerTool(
    toolName,
    {
      title: 'Store memory or chain',
      description: getToolDoc('kairos_mint'),
      inputSchema: mintInputSchema,
      outputSchema: mintOutputSchema
    },
    async (params: any) => {
      const tenantId = getTenantId();
      const ctx = getSpaceContextFromStorage();
      const rawSpace = typeof params?.space === 'string' ? params.space.trim() : '';
      const spaceParam = rawSpace.toLowerCase();
      let resolvedSpaceId: string;
      if (params?.space === undefined || rawSpace === '' || spaceParam === 'personal') {
        resolvedSpaceId = ctx.defaultWriteSpaceId || ctx.allowedSpaceIds[0] || '';
      } else if (spaceParam === KAIROS_APP_SPACE_DISPLAY_NAME.toLowerCase()) {
        const msg = `Cannot mint into "${KAIROS_APP_SPACE_DISPLAY_NAME}"; it is read-only. Use "personal" or a group name.`;
        mcpToolCalls.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
        mcpToolErrors.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: 'SPACE_READ_ONLY', message: msg }) }]
        };
      } else {
        const groupName = rawSpace.startsWith('Group: ') ? rawSpace.slice(7).trim() : rawSpace;
        const match = ctx.allowedSpaceIds.find((id) => {
          if (id === groupName) return true;
          if (id.startsWith('group:') && id.split(':').pop() === groupName) return true;
          return false;
        });
        if (!match) {
          const msg = `Group or space "${groupName}" not found or not in your allowed spaces. Use kairos_spaces to list available spaces (use the name or group ref, e.g. "Personal", "Group: team1", or "team1").`;
          mcpToolCalls.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
          mcpToolErrors.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
          return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ error: 'SPACE_NOT_FOUND', message: msg }) }]
          };
        }
        resolvedSpaceId = match;
      }
      if (!resolvedSpaceId) {
        const msg = 'No space available for minting. Check authentication and allowed spaces.';
        return {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: 'NO_SPACE', message: msg }) }]
        };
      }
      logger.debug(`kairos_mint space_id=${resolvedSpaceId}`);
      const inputSize = JSON.stringify(params).length;
      mcpToolInputSize.observe({ tool: toolName, tenant_id: tenantId }, inputSize);

      const timer = mcpToolDuration.startTimer({
        tool: toolName,
        tenant_id: tenantId
      });

      const narrowedContext = {
        ...ctx,
        allowedSpaceIds: [resolvedSpaceId],
        defaultWriteSpaceId: resolvedSpaceId
      };

      const respond = (output: MintOutput) => {
        mcpToolCalls.inc({ tool: toolName, status: 'success', tenant_id: tenantId });
        mcpToolOutputSize.observe({ tool: toolName, tenant_id: tenantId }, JSON.stringify(output).length);
        timer({ tool: toolName, status: 'success', tenant_id: tenantId });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output) }],
          structuredContent: output
        };
      };

      try {
        const input = mintInputSchema.parse(params);
        const output = await executeMint(memoryStore, input, (fn) =>
          runWithSpaceContextAsync(narrowedContext, fn)
        );
        return respond(output);
      } catch (error) {
        const err = error as { code?: string; details?: Record<string, unknown>; message?: string };
        if (error instanceof MintError) {
          mcpToolCalls.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
          mcpToolErrors.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
          timer({ tool: toolName, status: 'error', tenant_id: tenantId });
          return {
            isError: true,
            content: [{ type: 'text' as const, text: JSON.stringify({ error: error.code, message: error.message, ...error.details }) }]
          };
        }
        if (error instanceof KairosError) {
          mcpToolCalls.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
          mcpToolErrors.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
          timer({ tool: toolName, status: 'error', tenant_id: tenantId });
          return {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({
                  error: error.code,
                  message: error.message,
                  ...(error.details && typeof error.details === 'object' ? error.details : {})
                })
              }
            ]
          };
        }
        if (err?.code === 'DUPLICATE_CHAIN' || err?.code === 'DUPLICATE_KEY') {
          mcpToolCalls.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
          mcpToolErrors.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
          timer({ tool: toolName, status: 'error', tenant_id: tenantId });
          return {
            isError: true,
            content: [{ type: 'text' as const, text: JSON.stringify({ error: 'DUPLICATE_CHAIN', ...(err.details || {}) }) }]
          };
        }
        if (err?.code === 'SIMILAR_MEMORY_FOUND') {
          kairosMintSimilarMemoryFound.inc({ transport: 'mcp', tenant_id: tenantId });
          const d = err.details || {};
          mcpToolCalls.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
          mcpToolErrors.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
          timer({ tool: toolName, status: 'error', tenant_id: tenantId });
          return {
            isError: true,
            content: [{ type: 'text' as const, text: JSON.stringify({
              error: 'SIMILAR_MEMORY_FOUND',
              existing_memory: (d as any).existing_memory,
              similarity_score: (d as any).similarity_score,
              message: (d as any).message ?? 'A very similar memory already exists. Verify it before overwriting.',
              must_obey: (d as any).must_obey ?? true,
              next_action: (d as any).next_action,
              ...((d as any).content_preview !== undefined && { content_preview: (d as any).content_preview })
            }) }]
          };
        }
        logger.error(`[kairos_mint] Failed to store memory chain space_id=${resolvedSpaceId}`, error);
        mcpToolCalls.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
        mcpToolErrors.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
        timer({ tool: toolName, status: 'error', tenant_id: tenantId });
        return {
          isError: true,
          content: [{ type: 'text' as const, text: JSON.stringify({ error: 'STORE_FAILED', message: err?.message ?? String(error) }) }]
        };
      }
    }
  );
}
