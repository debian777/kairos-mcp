import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';
import { executionTraceStore, type TrainingPair } from '../services/execution-trace-store.js';
import { getAdapterId } from '../services/memory/memory-accessors.js';
import { getSpaceContextFromStorage, getTenantId } from '../utils/tenant-context.js';
import { mcpToolCalls, mcpToolDuration, mcpToolErrors, mcpToolInputSize, mcpToolOutputSize } from '../services/metrics/mcp-metrics.js';
import { executeDump } from './dump.js';
import { exportInputSchema, exportOutputSchema, type ExportInput, type ExportOutput } from './export_schema.js';
import { parseKairosUri } from './kairos-uri.js';
import { mcpLooseToolInput } from './mcp-loose-input-schema.js';
import { mcpToolInputValidationErrorResult } from './mcp-tool-input-teaching.js';
import { spaceIdToDisplayName, spaceKindFromSpaceId } from '../utils/space-display.js';
import { isRewardEligibleForPreference, isRewardEligibleForSft } from '../services/reward-evals.js';
import type { RewardRecord, TensorValue } from '../types/memory.js';

interface RegisterExportOptions {
  toolName?: string;
  qdrantService?: QdrantService;
}

interface RewardJsonlItem {
  instruction: {
    activation_query: string | null;
    tensor_in: Record<string, unknown>;
    layer_instructions: string;
  };
  response: {
    tensor_out: TensorValue | null;
    trace: string | null;
    raw_solution: unknown | null;
  };
  reward: {
    outcome: RewardRecord['outcome'];
    score: number | null;
    signed_score: number | null;
    quality_bonus: number | null;
    feedback: string | null;
    rater: string | null;
    llm_model_id: string | null;
    rubric_version: string | null;
    grader_kind: NonNullable<RewardRecord['grader_kind']>;
    evaluation_label: RewardRecord['evaluation_label'] | null;
    exportable_for_sft: boolean;
    exportable_for_preference: boolean;
    sft_blockers: string[];
    preference_blockers: string[];
    rated_at: string;
  };
  metadata: {
    execution_id: string;
    adapter_uri: string;
    layer_uri: string;
    layer_index: number;
    timestamp: string;
  };
}

async function resolveAdapter(memoryStore: MemoryQdrantStore, qdrantService: QdrantService | undefined, uri: string) {
  const parsed = parseKairosUri(uri);
  if (parsed.kind === 'adapter') {
    if (qdrantService) {
      const layers = await qdrantService.getAdapterLayers(parsed.id);
      const firstLayerId = layers[0]?.uuid;
      if (firstLayerId) {
        return { adapterId: parsed.id, layerId: firstLayerId };
      }
    }
    const layer = await memoryStore.getMemory(parsed.id);
    if (layer) {
      return { adapterId: parsed.id, layerId: layer.memory_uuid };
    }
    throw new Error('Adapter not found');
  }

  const memory = await memoryStore.getMemory(parsed.id);
  const adapterId = memory ? getAdapterId(memory) : parsed.id;
  return { adapterId, layerId: parsed.id };
}

function toCurrentMarkdown(markdownDoc: string): string {
  return markdownDoc
    .replaceAll('"challenge":', '"contract":')
    .replaceAll('Natural Language Triggers', 'Activation Patterns')
    .replaceAll('Completion Rule', 'Reward Signal');
}

function stringifyLines(items: unknown[]): string {
  return items.map((item) => JSON.stringify(item)).join('\n');
}

function canonicalLayerUri(uri: string): string {
  try {
    const parsed = parseKairosUri(uri);
    return parsed.kind === 'layer' ? `kairos://layer/${parsed.id}` : uri;
  } catch {
    return uri;
  }
}

function toRewardJsonlItem(pair: TrainingPair & { reward: RewardRecord }): RewardJsonlItem {
  return {
    instruction: {
      activation_query: pair.instruction.activation_query ?? null,
      tensor_in: pair.instruction.tensor_in,
      layer_instructions: pair.instruction.layer_instructions
    },
    response: {
      tensor_out: pair.response.tensor_out ?? null,
      trace: pair.response.trace ?? null,
      raw_solution: pair.response.raw_solution ?? null
    },
    reward: {
      outcome: pair.reward.outcome,
      score: pair.reward.score ?? null,
      signed_score: pair.reward.signed_score ?? null,
      quality_bonus: pair.reward.quality_bonus ?? null,
      feedback: pair.reward.feedback ?? null,
      rater: pair.reward.rater ?? null,
      llm_model_id: pair.reward.llm_model_id ?? null,
      rubric_version: pair.reward.rubric_version ?? null,
      grader_kind: pair.reward.grader_kind ?? 'unknown',
      evaluation_label: pair.reward.evaluation_label ?? null,
      exportable_for_sft: pair.reward.exportable_for_sft ?? isRewardEligibleForSft(pair.reward),
      exportable_for_preference:
        pair.reward.exportable_for_preference ?? isRewardEligibleForPreference(pair.reward),
      sft_blockers: pair.reward.sft_blockers ?? [],
      preference_blockers: pair.reward.preference_blockers ?? [],
      rated_at: pair.reward.rated_at
    },
    metadata: {
      execution_id: pair.execution_id,
      adapter_uri: pair.adapter_uri,
      layer_uri: canonicalLayerUri(pair.layer_uri),
      layer_index: pair.layer_index,
      timestamp: pair.timestamp
    }
  };
}

function buildRewardJsonlItems(pairs: TrainingPair[]): RewardJsonlItem[] {
  return pairs
    .filter((pair): pair is TrainingPair & { reward: RewardRecord } => Boolean(pair.reward))
    .map((pair) => toRewardJsonlItem(pair));
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
      content: toCurrentMarkdown(String(dump['markdown_doc'] ?? '')),
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
    const key = `${canonicalLayerUri(pair.layer_uri)}:${pair.layer_index}`;
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
        layer_uri: canonicalLayerUri(chosen.layer_uri),
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

