import type { Memory } from '../types/memory.js';
import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';
import { getTenantId, getSpaceContextFromStorage, runWithSpaceContextAsync } from '../utils/tenant-context.js';
import { resolveSpaceParamForContext } from '../utils/resolve-space-param.js';
import { executeTrainStore, TrainError } from './train-store.js';
import { executeDump } from './dump.js';
import { CREATION_PROTOCOL_URI } from '../services/memory/validate-protocol-structure.js';
import { buildAdapterUri, buildLayerUri } from './kairos-uri.js';
import {
  trainInputSchema,
  trainOutputSchema,
  type TrainInput,
  type TrainOutput,
  type TrainStoreInput
} from './train_schema.js';
import { kairosTrainSimilarAdapterFound, mcpToolCalls, mcpToolDuration, mcpToolErrors, mcpToolInputSize, mcpToolOutputSize } from '../services/metrics/mcp-metrics.js';
import { mcpLooseToolInput } from './mcp-loose-input-schema.js';
import { mcpToolInputValidationErrorResult } from './mcp-tool-input-teaching.js';

interface RegisterTrainOptions {
  toolName?: string;
  qdrantService?: QdrantService;
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
  'adapter_id',
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
  const normalizedCode = error.code === 'DUPLICATE_KEY' ? 'DUPLICATE_ADAPTER' : error.code;
  if (normalizedCode === 'DUPLICATE_ADAPTER') {
    return {
      error: 'DUPLICATE_ADAPTER',
      message: 'Adapter with this label already exists. Use force_update: true to overwrite.',
      ...sanitizeTrainDetails(error.details)
    };
  }
  if (normalizedCode === 'SIMILAR_MEMORY_FOUND') {
    const details = sanitizeTrainDetails(error.details);
    return {
      error: 'SIMILAR_MEMORY_FOUND',
      message: typeof details['next_action'] === 'string'
        ? 'Adapter title is very similar to an existing one. Inspect the match; use force_update: true with the same adapter id to replace.'
        : 'Adapter title is very similar to an existing one.',
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

async function resolveMarkdownForTrain(
  memoryStore: MemoryQdrantStore,
  qdrantService: QdrantService | undefined,
  input: TrainInput
): Promise<string> {
  const fromInput = typeof input.markdown_doc === 'string' ? input.markdown_doc.trim() : '';
  const sourceUri = input.source_adapter_uri?.trim();
  if (!sourceUri) {
    return fromInput;
  }
  if (!qdrantService) {
    throw new TrainError(
      'SOURCE_ADAPTER_UNAVAILABLE',
      'Forking from source_adapter_uri requires the adapter store; try again or pass markdown_doc only.',
      { must_obey: true }
    );
  }
  const adapterMatch = /^kairos:\/\/adapter\/([0-9a-f-]{36})$/i.exec(sourceUri);
  if (!adapterMatch?.[1]) {
    throw new TrainError('INVALID_SOURCE_URI', 'source_adapter_uri must be kairos://adapter/{uuid}', {
      must_obey: true
    });
  }
  const adapterId = adapterMatch[1]!;
  const layers = await qdrantService.getAdapterLayers(adapterId);
  const headUuid = layers[0]?.uuid ?? adapterId;
  const dump = await executeDump(memoryStore, qdrantService, {
    uri: `kairos://mem/${headUuid}`,
    protocol: true
  });
  const dumped = typeof dump['markdown_doc'] === 'string' ? dump['markdown_doc'].trim() : '';
  if (!dumped) {
    throw new TrainError('SOURCE_EXPORT_EMPTY', 'Could not export markdown from the source adapter.', {
      must_obey: true
    });
  }
  return fromInput.length > 0 ? fromInput : dumped;
}

export async function executeTrain(
  memoryStore: MemoryQdrantStore,
  input: TrainInput,
  runStore: <T>(fn: () => Promise<T>) => Promise<T>,
  qdrantService?: QdrantService
): Promise<TrainOutput> {
  const markdownDoc = await resolveMarkdownForTrain(memoryStore, qdrantService, input);
  if (!markdownDoc || markdownDoc.length < 1) {
    throw new TrainError('MARKDOWN_REQUIRED', 'Provide markdown_doc and/or source_adapter_uri.', {
      must_obey: true
    });
  }
  const storePayload = {
    markdown_doc: markdownDoc,
    llm_model_id: input.llm_model_id,
    force_update: input.force_update,
    ...(input.protocol_version !== undefined && { protocol_version: input.protocol_version }),
    ...(input.space !== undefined && { space: input.space })
  };
  const result = await executeTrainStore(
    memoryStore,
    storePayload as TrainStoreInput,
    runStore as (fn: () => Promise<Memory[]>) => Promise<Memory[]>
  );
  const items = await Promise.all(
    result.items.map(async (item) => {
      const memory = await memoryStore.getMemory(item.memory_uuid);
      const adapterId = memory?.adapter?.id ?? item.memory_uuid;
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
  const qdrantService = options.qdrantService;

  server.registerTool(
    toolName,
    {
      title: 'Register a new adapter',
      description: getToolDoc('train') || 'Store a new adapter from markdown.',
      inputSchema: mcpLooseToolInput(trainInputSchema),
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
      } else {
        const r = resolveSpaceParamForContext(ctx, rawSpace);
        if (!r.ok) {
          const errKey = r.code === 'SPACE_READ_ONLY' ? 'SPACE_READ_ONLY' : 'SPACE_NOT_FOUND';
          return {
            isError: true,
            content: [{ type: 'text' as const, text: JSON.stringify({ error: errKey, message: r.message }) }]
          };
        }
        resolvedSpaceId = r.spaceId;
      }

      mcpToolInputSize.observe({ tool: toolName, tenant_id: tenantId }, JSON.stringify(params).length);
      const timer = mcpToolDuration.startTimer({ tool: toolName, tenant_id: tenantId });
      const narrowedContext = {
        ...ctx,
        allowedSpaceIds: [resolvedSpaceId],
        defaultWriteSpaceId: resolvedSpaceId
      };

      const parsedInput = trainInputSchema.safeParse(params);
      if (!parsedInput.success) {
        mcpToolCalls.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
        mcpToolErrors.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
        timer({ tool: toolName, status: 'error', tenant_id: tenantId });
        return mcpToolInputValidationErrorResult('train', parsedInput.error, params);
      }
      const input = parsedInput.data;

      try {
        const output = await executeTrain(memoryStore, input, (fn) => runWithSpaceContextAsync(narrowedContext, fn), qdrantService);
        mcpToolCalls.inc({ tool: toolName, status: 'success', tenant_id: tenantId });
        mcpToolOutputSize.observe({ tool: toolName, tenant_id: tenantId }, JSON.stringify(output).length);
        timer({ tool: toolName, status: 'success', tenant_id: tenantId });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output) }],
          structuredContent: output
        };
      } catch (error) {
        const err = error as { code?: string; details?: Record<string, unknown>; message?: string };
        if (error instanceof TrainError) {
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
          kairosTrainSimilarAdapterFound.inc({ transport: 'mcp', tenant_id: tenantId });
        }
        if (err.code === 'DUPLICATE_ADAPTER' || err.code === 'DUPLICATE_KEY' || err.code === 'SIMILAR_MEMORY_FOUND') {
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

