import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';
import { executionTraceStore } from '../services/execution-trace-store.js';
import { getTenantId } from '../utils/tenant-context.js';
import { mcpToolCalls, mcpToolDuration, mcpToolErrors, mcpToolInputSize, mcpToolOutputSize } from '../services/metrics/mcp-metrics.js';
import { executeDump } from './kairos_dump.js';
import { exportInputSchema, exportOutputSchema, type ExportInput, type ExportOutput } from './export_schema.js';
import { parseKairosUri } from './v10-uri.js';
import { isRewardEligibleForPreference, isRewardEligibleForSft } from '../services/reward-evals.js';

interface RegisterExportOptions {
  toolName?: string;
  qdrantService?: QdrantService;
}

async function resolveAdapter(memoryStore: MemoryQdrantStore, qdrantService: QdrantService | undefined, uri: string) {
  const parsed = parseKairosUri(uri);
  if (parsed.kind === 'adapter') {
    return { adapterId: parsed.id, layerId: parsed.id };
  }

  const memory = await memoryStore.getMemory(parsed.id);
  const adapterId = memory?.adapter?.id ?? memory?.chain?.id ?? parsed.id;
  return { adapterId, layerId: parsed.id };
}

function toMarkdownV10(markdownDoc: string): string {
  return markdownDoc
    .replaceAll('"challenge":', '"contract":')
    .replaceAll('Natural Language Triggers', 'Activation Patterns')
    .replaceAll('Completion Rule', 'Reward Signal');
}

function stringifyLines(items: unknown[]): string {
  return items.map((item) => JSON.stringify(item)).join('\n');
}

export async function executeExport(
  memoryStore: MemoryQdrantStore,
  qdrantService: QdrantService | undefined,
  input: ExportInput
): Promise<ExportOutput> {
  const { adapterId, layerId } = await resolveAdapter(memoryStore, qdrantService, input.uri);

  if (input.format === 'markdown') {
    const dump = await executeDump(memoryStore, qdrantService, {
      uri: `kairos://mem/${layerId}`,
      protocol: true
    });
    return {
      uri: input.uri,
      format: input.format,
      content_type: 'text/markdown',
      content: toMarkdownV10(String(dump['markdown_doc'] ?? '')),
      item_count: 1,
      adapter_name: typeof dump['label'] === 'string' ? dump['label'] : null,
      adapter_version: typeof dump['protocol_version'] === 'string' ? dump['protocol_version'] : null
    };
  }

  const pairs = await executionTraceStore.buildTrainingPairsForAdapter(adapterId, input.include_reward);

  if (input.format === 'trace_jsonl') {
    return {
      uri: input.uri,
      format: input.format,
      content_type: 'application/x-ndjson',
      content: stringifyLines(pairs),
      item_count: pairs.length
    };
  }

  if (input.format === 'sft_jsonl') {
    const sftPairs = input.include_reward ? pairs.filter((pair) => isRewardEligibleForSft(pair.reward)) : pairs;
    const sftItems = sftPairs.map((pair) => ({
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            activation_query: pair.instruction.activation_query,
            tensor_in: pair.instruction.tensor_in,
            layer_instructions: pair.instruction.layer_instructions
          })
        },
        {
          role: 'assistant',
          content: JSON.stringify({
            tensor_out: pair.response.tensor_out,
            trace: pair.response.trace,
            raw_solution: pair.response.raw_solution
          })
        }
      ],
      metadata: {
        adapter_uri: pair.adapter_uri,
        layer_uri: pair.layer_uri,
        layer_index: pair.layer_index,
        reward: pair.reward
      }
    }));
    return {
      uri: input.uri,
      format: input.format,
      content_type: 'application/x-ndjson',
      content: stringifyLines(sftItems),
      item_count: sftItems.length
    };
  }

  const preferenceItems: Array<{
    prompt: string;
    chosen: string;
    rejected: string;
    metadata: { adapter_uri: string; layer_uri: string; layer_index: number };
  }> = [];
  const byLayer = new Map<string, typeof pairs>();
  for (const pair of pairs) {
    const key = `${pair.layer_uri}:${pair.layer_index}`;
    byLayer.set(key, [...(byLayer.get(key) ?? []), pair]);
  }
  for (const layerPairs of byLayer.values()) {
    const eligiblePairs = layerPairs.filter((pair) => isRewardEligibleForPreference(pair.reward));
    const chosen = eligiblePairs
      .filter((pair) => pair.reward?.outcome === 'success')
      .sort((a, b) => (b.reward?.score ?? 0) - (a.reward?.score ?? 0))[0];
    const rejected = eligiblePairs
      .filter((pair) => pair.reward?.outcome === 'failure')
      .sort((a, b) => (b.reward?.score ?? 0) - (a.reward?.score ?? 0))[0];
    if (!chosen || !rejected) {
      continue;
    }
    preferenceItems.push({
      prompt: JSON.stringify(chosen.instruction),
      chosen: JSON.stringify(chosen.response),
      rejected: JSON.stringify(rejected.response),
      metadata: {
        adapter_uri: chosen.adapter_uri,
        layer_uri: chosen.layer_uri,
        layer_index: chosen.layer_index
      }
    });
  }
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
      description: getToolDoc('export') || 'Export adapter markdown or training datasets.',
      inputSchema: exportInputSchema,
      outputSchema: exportOutputSchema
    },
    async (params: unknown) => {
      const tenantId = getTenantId();
      mcpToolInputSize.observe({ tool: toolName, tenant_id: tenantId }, JSON.stringify(params).length);
      const timer = mcpToolDuration.startTimer({ tool: toolName, tenant_id: tenantId });

      try {
        const input = exportInputSchema.parse(params);
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

