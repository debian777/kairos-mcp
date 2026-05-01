import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { executionTraceStore } from '../services/execution-trace-store.js';
import { getSpaceContextFromStorage, getTenantId } from '../utils/tenant-context.js';
import { mcpToolCalls, mcpToolDuration, mcpToolErrors, mcpToolInputSize, mcpToolOutputSize } from '../services/metrics/mcp-metrics.js';
import { executeDump } from './dump.js';
import { exportInputSchema, exportOutputSchema, type ExportInput, type ExportOutput } from './export_schema.js';
import { parseKairosUri } from './kairos-uri.js';
import { mcpLooseToolInput } from './mcp-loose-input-schema.js';
import { mcpToolInputValidationErrorResult } from './mcp-tool-input-teaching.js';
import { spaceIdToDisplayName, spaceKindFromSpaceId } from '../utils/space-display.js';
import { executeExportSource } from './export-source.js';
import { resolveExportAdapter } from './export-resolve-adapter.js';
import { buildPreferenceJsonlItems, buildRewardJsonlItems, buildSftJsonlItems, stringifyLines } from './export-reward-jsonl.js';
import { resolveToolDoc } from '../utils/mcp-tool-doc-runtime.js';

interface RegisterExportOptions {
  toolName?: string;
  qdrantService?: QdrantService;
}

function toCurrentMarkdown(markdownDoc: string): string {
  return markdownDoc.replaceAll('"challenge":', '"contract":');
}

export async function executeExport(
  memoryStore: MemoryQdrantStore,
  qdrantService: QdrantService | undefined,
  input: ExportInput
): Promise<ExportOutput> {
  const parsedUri = parseKairosUri(input.uri.trim());
  if (parsedUri.kind === 'artifact') {
    return executeExportSource(memoryStore, qdrantService, input.uri, resolveExportAdapter);
  }

  if (input.format === 'source') {
    return executeExportSource(memoryStore, qdrantService, input.uri, resolveExportAdapter);
  }

  const { adapterId, layerId } = await resolveExportAdapter(memoryStore, qdrantService, input.uri);

  if (input.format === 'markdown') {
    const dump = await executeDump(memoryStore, qdrantService, {
      uri: `kairos://layer/${layerId}`,
      protocol: true
    });
    const headMemory = await memoryStore.getMemory(layerId);
    const sid = typeof headMemory?.space_id === 'string' ? headMemory.space_id.trim() : '';
    const spaceNamesById = getSpaceContextFromStorage().spaceNamesById;
    const spaceFields =
      sid.length > 0
        ? {
            space_id: sid,
            space_name: spaceIdToDisplayName(sid, spaceNamesById),
            space_type: spaceKindFromSpaceId(sid)
          }
        : {
            space_id: null,
            space_name: null
          };
    return {
      uri: input.uri,
      format: input.format,
      content_type: 'text/markdown',
      content: toCurrentMarkdown(String(dump['content'] ?? '')),
      item_count: 1,
      adapter_name: typeof dump['label'] === 'string' ? dump['label'] : null,
      adapter_version: typeof dump['adapter_version'] === 'string' ? dump['adapter_version'] : null,
      ...spaceFields
    };
  }

  const pairs = await executionTraceStore.buildTrainingPairsForAdapter(
    adapterId,
    input.format === 'reward_jsonl' ? true : input.include_reward
  );

  if (input.format === 'trace_jsonl') {
    return {
      uri: input.uri,
      format: input.format,
      content_type: 'application/x-ndjson',
      content: stringifyLines(pairs),
      item_count: pairs.length
    };
  }

  if (input.format === 'reward_jsonl') {
    const rewardItems = buildRewardJsonlItems(pairs);
    return {
      uri: input.uri,
      format: input.format,
      content_type: 'application/x-ndjson',
      content: stringifyLines(rewardItems),
      item_count: rewardItems.length
    };
  }

  if (input.format === 'sft_jsonl') {
    const sftItems = buildSftJsonlItems(pairs, input.include_reward);
    return {
      uri: input.uri,
      format: input.format,
      content_type: 'application/x-ndjson',
      content: stringifyLines(sftItems),
      item_count: sftItems.length
    };
  }

  const preferenceItems = buildPreferenceJsonlItems(pairs);
  return {
    uri: input.uri,
    format: input.format,
    content_type: 'application/x-ndjson',
    content: stringifyLines(preferenceItems),
    item_count: preferenceItems.length
  };
}

export function registerExportTool(server: any, memoryStore: MemoryQdrantStore, options: RegisterExportOptions = {}) {
  const toolName = options.toolName || 'export';
  const qdrantService = options.qdrantService;

  server.registerTool(
    toolName,
    {
      title: 'Export adapter or training data',
      description: resolveToolDoc('export') || 'Export adapter markdown or training datasets.',
      inputSchema: mcpLooseToolInput(exportInputSchema),
      outputSchema: exportOutputSchema
    },
    async (params: unknown) => {
      const tenantId = getTenantId();
      mcpToolInputSize.observe({ tool: toolName, tenant_id: tenantId }, JSON.stringify(params).length);
      const timer = mcpToolDuration.startTimer({ tool: toolName, tenant_id: tenantId });

      const parsedInput = exportInputSchema.safeParse(params);
      if (!parsedInput.success) {
        mcpToolCalls.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
        mcpToolErrors.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
        timer({ tool: toolName, status: 'error', tenant_id: tenantId });
        return mcpToolInputValidationErrorResult('export', parsedInput.error, params);
      }
      const input = parsedInput.data;

      try {
        const output = await executeExport(memoryStore, qdrantService, input);
        mcpToolCalls.inc({ tool: toolName, status: 'success', tenant_id: tenantId });
        mcpToolOutputSize.observe({ tool: toolName, tenant_id: tenantId }, JSON.stringify(output).length);
        timer({ tool: toolName, status: 'success', tenant_id: tenantId });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output) }],
          structuredContent: output
        };
      } catch (error) {
        mcpToolCalls.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
        mcpToolErrors.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
        timer({ tool: toolName, status: 'error', tenant_id: tenantId });
        throw error;
      }
    }
  );
}

