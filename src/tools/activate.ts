import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';
import { structuredLogger } from '../utils/structured-logger.js';
import { mcpToolCalls, mcpToolDuration, mcpToolErrors, mcpToolInputSize, mcpToolOutputSize } from '../services/metrics/mcp-metrics.js';
import { getTenantId, runWithOptionalSpaceAsync } from '../utils/tenant-context.js';
import { executeSearch } from './search.js';
import { activateInputSchema, activateOutputSchema, type ActivateInput, type ActivateOutput } from './activate_schema.js';
import { buildAdapterUri } from './kairos-uri.js';
import { mcpLooseToolInput } from './mcp-loose-input-schema.js';
import { mcpToolInputValidationErrorResult } from './mcp-tool-input-teaching.js';

interface RegisterActivateOptions {
  toolName?: string;
  qdrantService?: QdrantService;
}

function extractUuid(uri: string): string {
  return uri.split('/').pop()?.split('?')[0] ?? '';
}

async function mapSearchToActivate(
  searchOutput: Awaited<ReturnType<typeof executeSearch>>
): Promise<ActivateOutput> {
  const choices = await Promise.all(
    searchOutput.choices.map(async (choice) => {
      if (choice.role !== 'match') {
        const fallbackId = extractUuid(choice.uri);
        const adapterUri = buildAdapterUri(fallbackId);
        return {
          uri: adapterUri,
          label: choice.label,
          adapter_name: choice.adapter_name,
          activation_score: choice.score,
          role: choice.role,
          tags: choice.tags,
          next_action: choice.role === 'create'
            ? 'call train with adapter markdown to register a new adapter'
            : `call forward with ${adapterUri} to execute the refine adapter`,
          adapter_version: choice.adapter_version,
          activation_patterns: [],
          space_name: choice.space_name ?? null
        };
      }

      const adapterUri = choice.uri;
      const adapterLabel = choice.adapter_name ?? choice.label;
      return {
        uri: adapterUri,
        label: adapterLabel,
        adapter_name: adapterLabel,
        activation_score: choice.score,
        role: choice.role,
        tags: choice.tags,
        next_action: `call forward with ${adapterUri} to execute this adapter`,
        adapter_version: choice.adapter_version,
        activation_patterns: choice.activation_patterns ?? [],
        space_name: choice.space_name ?? null
      };
    })
  );

  return {
    must_obey: true,
    message: searchOutput.message
      .replaceAll('protocol', 'adapter')
      .replaceAll('Protocol', 'Adapter'),
    next_action: "Pick one choice and follow that choice's next_action.",
    choices
  };
}

export async function executeActivate(
  memoryStore: MemoryQdrantStore,
  qdrantService: QdrantService | undefined,
  input: ActivateInput
): Promise<ActivateOutput> {
  const searchOutput = await executeSearch(
    memoryStore,
    qdrantService,
    input,
    input.space ?? input.space_id
      ? {
          runInSpace: (fn) => runWithOptionalSpaceAsync(input.space ?? input.space_id ?? '', fn)
        }
      : undefined
  );

  return mapSearchToActivate(searchOutput);
}

export function registerActivateTool(server: any, memoryStore: MemoryQdrantStore, options: RegisterActivateOptions = {}) {
  const toolName = options.toolName || 'activate';
  const qdrantService = options.qdrantService;

  structuredLogger.debug(`activate registration inputSchema: ${JSON.stringify(activateInputSchema)}`);
  structuredLogger.debug(`activate registration outputSchema: ${JSON.stringify(activateOutputSchema)}`);

  server.registerTool(
    toolName,
    {
      title: 'Activate the best adapter',
      description: getToolDoc('activate') || 'Find the best adapter for the current input and return ranked activation choices.',
      inputSchema: mcpLooseToolInput(activateInputSchema),
      outputSchema: activateOutputSchema
    },
    async (params: unknown) => {
      const tenantId = getTenantId();
      mcpToolInputSize.observe({ tool: toolName, tenant_id: tenantId }, JSON.stringify(params).length);
      const timer = mcpToolDuration.startTimer({ tool: toolName, tenant_id: tenantId });

      const parsedInput = activateInputSchema.safeParse(params);
      if (!parsedInput.success) {
        mcpToolCalls.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
        mcpToolErrors.inc({ tool: toolName, status: 'error', tenant_id: tenantId });
        timer({ tool: toolName, status: 'error', tenant_id: tenantId });
        return mcpToolInputValidationErrorResult('activate', parsedInput.error, params);
      }
      const input = parsedInput.data;

      try {
        const output = await executeActivate(memoryStore, qdrantService, input);
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

