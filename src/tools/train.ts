import type { MemoryQdrantStore } from '../services/memory/store.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';
import { KAIROS_APP_SPACE_DISPLAY_NAME } from '../utils/space-display.js';
import { getTenantId, getSpaceContextFromStorage, runWithSpaceContextAsync } from '../utils/tenant-context.js';
import { executeMint, MintError } from './kairos_mint.js';
import { CREATION_PROTOCOL_URI } from '../services/memory/validate-protocol-structure.js';
import { buildAdapterUri, buildLayerUri } from './v10-uri.js';
import { trainInputSchema, trainOutputSchema, type TrainInput, type TrainOutput } from './train_schema.js';
import { kairosMintSimilarMemoryFound, mcpToolCalls, mcpToolDuration, mcpToolErrors, mcpToolInputSize, mcpToolOutputSize } from '../services/metrics/mcp-metrics.js';

interface RegisterTrainOptions {
  toolName?: string;
}

function creationAdapterUri(): string {
  const uuid = CREATION_PROTOCOL_URI.split('/').pop() ?? '';
  return buildAdapterUri(uuid);
}

const TRAIN_ERROR_DETAIL_KEYS = new Set([
  'missing',
  'must_obey',
  'next_action',
  'existing_memory',
  'similarity_score',
  'content_preview',
  'chain_id',
  'items'
]);

function sanitizeTrainDetails(details?: Record<string, unknown>): Record<string, unknown> {
  if (!details) return {};
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (!TRAIN_ERROR_DETAIL_KEYS.has(key)) continue;
    output[key] = value;
  }
  return output;
}

function formatTrainErrorPayload(error: { code?: string; details?: Record<string, unknown>; message?: string }) {
  const normalizedCode = error.code === 'DUPLICATE_KEY' ? 'DUPLICATE_CHAIN' : error.code;
  if (normalizedCode === 'DUPLICATE_CHAIN') {
    return {
      error: 'DUPLICATE_CHAIN',
      message: 'Adapter with this label already exists. Use force_update: true to overwrite.',
      ...sanitizeTrainDetails(error.details)
    };
  }
  if (normalizedCode === 'SIMILAR_MEMORY_FOUND') {
    const details = sanitizeTrainDetails(error.details);
    return {
      error: 'SIMILAR_MEMORY_FOUND',
      message: typeof details['next_action'] === 'string'
        ? 'A very similar adapter already exists. Inspect it before replacing it.'
        : 'A very similar adapter already exists.',
      ...details
    };
  }
  return {
    error: normalizedCode ?? 'PROTOCOL_STRUCTURE_INVALID',
    message: (error.message ?? 'Adapter validation failed')
      .replaceAll('Protocol', 'Adapter')
      .replaceAll('protocol', 'adapter'),
    ...sanitizeTrainDetails(error.details),
    next_action: `call forward with ${creationAdapterUri()} to open the guided adapter creation flow`
  };
}

export async function executeTrain(
  memoryStore: MemoryQdrantStore,
  input: TrainInput,
  runStore: <T>(fn: () => Promise<T>) => Promise<T>
): Promise<TrainOutput> {
  const result = await executeMint(memoryStore, input as any, runStore as any);
  const items = await Promise.all(
    result.items.map(async (item) => {
      const memory = await memoryStore.getMemory(item.memory_uuid);
      const adapterId = memory?.adapter?.id ?? memory?.chain?.id ?? item.memory_uuid;
      return {
        uri: buildLayerUri(item.memory_uuid),
        layer_uuid: item.memory_uuid,
        adapter_uri: buildAdapterUri(adapterId),
        label: item.label,
        tags: item.tags
      };
    })
  );
  return {
    items,
    status: 'stored'
  };
}

export function registerTrainTool(server: any, memoryStore: MemoryQdrantStore, options: RegisterTrainOptions = {}) {
  const toolName = options.toolName || 'train';

  server.registerTool(
    toolName,
    {
      title: 'Register a new adapter',
      description: getToolDoc('train') || 'Store a new adapter from markdown.',
      inputSchema: trainInputSchema,
      outputSchema: trainOutputSchema
    },
    async (params: unknown) => {
      const tenantId = getTenantId();
      const ctx = getSpaceContextFromStorage();
      const rawSpace = typeof (params as any)?.space === 'string' ? (params as any).space.trim() : '';
      const spaceParam = rawSpace.toLowerCase();
      let resolvedSpaceId: string;

      if ((params as any)?.space === undefined || rawSpace === '' || spaceParam === 'personal') {
        resolvedSpaceId = ctx.defaultWriteSpaceId || ctx.allowedSpaceIds[0] || '';
      } else if (spaceParam === KAIROS_APP_SPACE_DISPLAY_NAME.toLowerCase()) {
        const msg = `Cannot train into "${KAIROS_APP_SPACE_DISPLAY_NAME}"; it is read-only. Use "personal" or a group name.`;
        return {
          isError: true,
          content: [{ type: 'text' as const, text: JSON.stringify({ error: 'SPACE_READ_ONLY', message: msg }) }]
        };
      } else {
        const groupName = rawSpace.startsWith('Group: ') ? rawSpace.slice(7).trim() : rawSpace;
        const match = ctx.allowedSpaceIds.find((id) => {
          if (id === groupName) return true;
          if (id.startsWith('group:') && id.split(':').pop() === groupName) return true;
          return false;
        });
        if (!match) {
          return {
            isError: true,
            content: [{ type: 'text' as const, text: JSON.stringify({ error: 'SPACE_NOT_FOUND', message: `Group or space "${groupName}" not found.` }) }]
          };
        }
        resolvedSpaceId = match;
      }

      mcpToolInputSize.observe({ tool: toolName, tenant_id: tenantId }, JSON.stringify(params).length);
      const timer = mcpToolDuration.startTimer({ tool: toolName, tenant_id: tenantId });
      const narrowedContext = {
        ...ctx,
        allowedSpaceIds: [resolvedSpaceId],
        defaultWriteSpaceId: resolvedSpaceId
      };

      try {
        const input = trainInputSchema.parse(params);
        const output = await executeTrain(memoryStore, input, (fn) => runWithSpaceContextAsync(narrowedContext, fn));
        mcpToolCalls.inc({ tool: toolName, status: 'success', tenant_id: tenantId });
        mcpToolOutputSize.observe({ tool: toolName, tenant_id: tenantId }, JSON.stringify(output).length);
        timer({ tool: toolName, status: 'success', tenant_id: tenantId });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output) }],
          structuredContent: output
        };
      } catch (error) {
        const err = error as { code?: string; details?: Record<string, unknown>; message?: string };
        if (error instanceof MintError) {
          mcpToolCalls.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
          mcpToolErrors.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
          timer({ tool: toolName, status: 'error', tenant_id: tenantId });
          return {
            isError: true,
            content: [{
              type: 'text' as const,
              text: JSON.stringify(formatTrainErrorPayload({
                code: error.code,
                ...(error.details ? { details: error.details } : {}),
                message: error.message
              }))
            }]
          };
        }
        if (err.code === 'SIMILAR_MEMORY_FOUND') {
          kairosMintSimilarMemoryFound.inc({ transport: 'mcp', tenant_id: tenantId });
        }
        if (err.code === 'DUPLICATE_CHAIN' || err.code === 'DUPLICATE_KEY' || err.code === 'SIMILAR_MEMORY_FOUND') {
          mcpToolCalls.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
          mcpToolErrors.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
          timer({ tool: toolName, status: 'error', tenant_id: tenantId });
          return {
            isError: true,
            content: [{ type: 'text' as const, text: JSON.stringify(formatTrainErrorPayload(err)) }]
          };
        }

        mcpToolCalls.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
        mcpToolErrors.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
        timer({ tool: toolName, status: 'error', tenant_id: tenantId });
        throw error;
      }
    }
  );
}

