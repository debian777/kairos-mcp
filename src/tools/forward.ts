import crypto from 'node:crypto';
import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';
import { getTenantId } from '../utils/tenant-context.js';
import { executionTraceStore } from '../services/execution-trace-store.js';
import { forwardRuntimeStore } from '../services/forward-runtime-store.js';
import { mcpToolCalls, mcpToolDuration, mcpToolErrors, mcpToolInputSize, mcpToolOutputSize } from '../services/metrics/mcp-metrics.js';
import { tryUserInputElicitation, type ProofOfWorkSubmission } from './next-pow-helpers.js';
import { executeNext } from './next.js';
import { forwardInputSchema, forwardOutputSchema, type ForwardInput, type ForwardOutput } from './forward_schema.js';
import { buildAdapterUri, buildLayerUri, parseKairosUri } from './kairos-uri.js';
import {
  buildForwardView,
  buildCurrentLayerView,
  loadMemoryForParsedUri,
  mapExecuteNextToForwardView,
  mapProofSolution,
  normalizeContract
} from './forward-view.js';
import { appendExecutionTrace, handleTensorForward, solutionToTensorValue } from './forward-trace.js';

interface RegisterForwardOptions {
  toolName?: string;
  qdrantService?: QdrantService;
}

export async function executeForward(
  server: any,
  memoryStore: MemoryQdrantStore,
  qdrantService: QdrantService | undefined,
  input: ForwardInput
): Promise<ForwardOutput> {
  const parsed = parseKairosUri(input.uri);
  const memory = await loadMemoryForParsedUri(memoryStore, qdrantService, parsed);
  if (!memory) {
    throw new Error('Layer or adapter not found');
  }

  const adapterId = memory.adapter?.id ?? memory.chain?.id ?? memory.memory_uuid;
  const adapterUri = buildAdapterUri(adapterId);
  const executionId = parsed.kind === 'layer' && parsed.executionId ? parsed.executionId : crypto.randomUUID();

  if (!(parsed.kind === 'layer' && parsed.executionId)) {
    await forwardRuntimeStore.startExecution({
      execution_id: executionId,
      adapter_id: adapterId,
      adapter_uri: adapterUri,
      merge_depth: 0,
      created_at: new Date().toISOString()
    });
    await executionTraceStore.startExecution({
      executionId,
      adapterId,
      adapterUri
    });
  }

  if (!input.solution) {
    return buildForwardView(memory, executionId);
  }

  const contract = normalizeContract(memory);
  if (contract?.type === 'tensor') {
    return handleTensorForward(memoryStore, memory, executionId, input.solution, qdrantService);
  }

  const tenantId = getTenantId();
  const tryElicit = (currentMemory: typeof memory, solution: ProofOfWorkSubmission, requestedUri: string) =>
    tryUserInputElicitation(server, currentMemory, solution, requestedUri, buildCurrentLayerView);

  const nextOutput = await executeNext(
    memoryStore,
    qdrantService,
    {
      uri: buildLayerUri(memory.memory_uuid, executionId),
      solution: mapProofSolution(input.solution)
    },
    tenantId,
    { tryElicit }
  );

  const tensorOut = solutionToTensorValue(input.solution);
  const executionMeta = await forwardRuntimeStore.getExecution(executionId);
  await appendExecutionTrace(
    executionId,
    memory,
    input.solution,
    executionMeta?.activation_query,
    {},
    tensorOut
  );

  return mapExecuteNextToForwardView(memoryStore, executionId, nextOutput);
}

export function registerForwardTool(server: any, memoryStore: MemoryQdrantStore, options: RegisterForwardOptions = {}) {
  const toolName = options.toolName || 'forward';
  const qdrantService = options.qdrantService;

  server.registerTool(
    toolName,
    {
      title: 'Run adapter forward pass',
      description: getToolDoc('forward') || 'Run the first or next adapter layer. Omitting solution starts a new execution.',
      inputSchema: forwardInputSchema,
      outputSchema: forwardOutputSchema
    },
    async (params: unknown) => {
      const tenantId = getTenantId();
      mcpToolInputSize.observe({ tool: toolName, tenant_id: tenantId }, JSON.stringify(params).length);
      const timer = mcpToolDuration.startTimer({ tool: toolName, tenant_id: tenantId });

      try {
        const input = forwardInputSchema.parse(params);
        const output = await executeForward(server, memoryStore, qdrantService, input);
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
