import crypto from 'node:crypto';
import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';
import { getTenantId } from '../utils/tenant-context.js';
import { resolveChainNextStep, resolveChainPreviousStep } from '../services/chain-utils.js';
import { executionTraceStore } from '../services/execution-trace-store.js';
import { forwardRuntimeStore } from '../services/forward-runtime-store.js';
import { mcpToolCalls, mcpToolDuration, mcpToolErrors, mcpToolInputSize, mcpToolOutputSize } from '../services/metrics/mcp-metrics.js';
import { getAdapterId, getInferenceContract, getLayerIndex } from '../services/memory/memory-accessors.js';
import { proofOfWorkStore } from '../services/proof-of-work-store.js';
import {
  GENESIS_HASH,
  handleProofSubmission,
  tryUserInputElicitation,
  type HandleProofResult,
  type ProofOfWorkSubmission
} from './next-pow-helpers.js';
import { buildMissingProofPayload } from './next-missing-proof-payload.js';
import {
  ensurePreviousProofCompleted,
  tryApplySolutionToPreviousStep,
  tryApplySolutionToPreviousStepWhenSolutionMatchesPrevious
} from './next-previous-step.js';
import { updateStepQuality } from './next.js';
import { forwardInputSchema, forwardOutputSchema, type ForwardInput, type ForwardOutput } from './forward_schema.js';
import { buildAdapterUri, buildLayerUri, parseKairosUri } from './kairos-uri.js';
import {
  buildForwardView,
  buildCurrentLayerView,
  loadMemoryForParsedUri,
  mapLayerPayloadToForwardView,
  mapProofSolution,
} from './forward-view.js';
import { appendExecutionTrace, handleTensorForward, solutionToTensorValue } from './forward-trace.js';

interface RegisterForwardOptions {
  toolName?: string;
  qdrantService?: QdrantService;
}

async function loadLayer(memoryStore: MemoryQdrantStore, layerId: string | undefined): Promise<Awaited<ReturnType<MemoryQdrantStore['getMemory']>>> {
  return layerId ? memoryStore.getMemory(layerId) : null;
}

async function expectedPreviousHash(
  memory: Awaited<ReturnType<MemoryQdrantStore['getMemory']>>,
  qdrantService: QdrantService | undefined
): Promise<string> {
  if (!memory || getLayerIndex(memory) <= 1) {
    return GENESIS_HASH;
  }
  const previous = await resolveChainPreviousStep(memory, qdrantService);
  if (!previous?.uuid) {
    return GENESIS_HASH;
  }
  return (await proofOfWorkStore.getProofHash(previous.uuid)) ?? GENESIS_HASH;
}

async function buildPostSubmissionView(params: {
  memoryStore: MemoryQdrantStore;
  currentMemory: Awaited<ReturnType<MemoryQdrantStore['getMemory']>>;
  executionId: string;
  proofHash?: string;
  qdrantService: QdrantService | undefined;
  message?: string;
}): Promise<ForwardOutput> {
  const { memoryStore, currentMemory, executionId, proofHash, qdrantService, message } = params;
  if (!currentMemory) {
    throw new Error('Layer not found while building forward response');
  }
  const next = await resolveChainNextStep(currentMemory, qdrantService);
  if (!next?.uuid) {
    return buildForwardView(currentMemory, executionId, {
      final: true,
      ...(message ? { message } : { message: 'Adapter layers complete. Call reward to finalize.' }),
      ...(proofHash ? { proofHash } : {})
    });
  }
  const nextMemory = await loadLayer(memoryStore, next.uuid);
  if (!nextMemory) {
    throw new Error(`Next layer ${next.uuid} could not be loaded`);
  }
  return buildForwardView(nextMemory, executionId, {
    ...(proofHash ? { proofHash } : {}),
    ...(message ? { message } : {})
  });
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

  const adapterId = getAdapterId(memory);
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

  const contract = getInferenceContract(memory);
  if (contract?.type === 'tensor') {
    return handleTensorForward(memoryStore, memory, executionId, input.solution, qdrantService);
  }

  const tenantId = getTenantId();
  const tryElicit = (currentMemory: typeof memory, solution: ProofOfWorkSubmission, requestedUri: string) =>
    tryUserInputElicitation(server, currentMemory, solution, requestedUri, buildCurrentLayerView);
  const requestedUri = buildLayerUri(memory.memory_uuid, executionId);
  let solutionToUse = mapProofSolution(input.solution);
  const elicitResult = await tryElicit(memory, solutionToUse, requestedUri);
  if ('payload' in elicitResult) {
    return mapLayerPayloadToForwardView(memoryStore, executionId, elicitResult.payload);
  }
  solutionToUse = elicitResult.solution;

  let submissionOutcome: HandleProofResult | undefined;
  if (!contract) {
    const previousAttempt = await tryApplySolutionToPreviousStep(
      memory,
      solutionToUse,
      (id) => memoryStore.getMemory(id),
      qdrantService
    );
    if (previousAttempt.applied) {
      if (previousAttempt.outcome.blockedPayload) {
        if (qdrantService) {
          await updateStepQuality(qdrantService, previousAttempt.prevMemory, 'failure', tenantId);
        }
        return mapLayerPayloadToForwardView(memoryStore, executionId, previousAttempt.outcome.blockedPayload);
      }
      const previousBlock = await ensurePreviousProofCompleted(
        memory,
        (id) => memoryStore.getMemory(id),
        qdrantService,
        executionId
      );
      if (previousBlock) {
        if (qdrantService) {
          await updateStepQuality(qdrantService, memory, 'failure', tenantId);
        }
        const payload = await buildMissingProofPayload(
          memory,
          previousBlock,
          requestedUri,
          memory.memory_uuid,
          (id) => memoryStore.getMemory(id),
          qdrantService,
          executionId
        );
        return mapLayerPayloadToForwardView(memoryStore, executionId, {
          must_obey: payload.retry_count < 3,
          current_step: payload.current_step,
          challenge: payload.challenge,
          message: previousBlock.message,
          next_action: payload.next_action,
          error_code: previousBlock.error_code || 'MISSING_PROOF',
          retry_count: payload.retry_count
        });
      }
      if (qdrantService && !previousAttempt.outcome.alreadyRecorded) {
        await updateStepQuality(qdrantService, previousAttempt.prevMemory, 'success', tenantId);
      }
      submissionOutcome = previousAttempt.outcome;
    }

    const executionMeta = await forwardRuntimeStore.getExecution(executionId);
    const tensorOut = solutionToTensorValue(input.solution);
    await appendExecutionTrace(
      executionId,
      previousAttempt.applied ? previousAttempt.prevMemory : memory,
      input.solution,
      executionMeta?.activation_query,
      {},
      tensorOut
    );
    return buildPostSubmissionView({
      memoryStore,
      currentMemory: memory,
      executionId,
      qdrantService,
      ...(submissionOutcome?.proofHash ? { proofHash: submissionOutcome.proofHash } : {}),
      message: submissionOutcome
        ? 'Applied the submitted solution to the pending prior layer and continued.'
        : 'Current layer has no contract; continuing.'
    });
  }

  const previousMatchAttempt = await tryApplySolutionToPreviousStepWhenSolutionMatchesPrevious(
    memory,
    solutionToUse,
    (id) => memoryStore.getMemory(id),
    qdrantService
  );
  if (previousMatchAttempt.applied) {
    if (previousMatchAttempt.outcome.blockedPayload) {
      if (qdrantService) {
        await updateStepQuality(qdrantService, previousMatchAttempt.prevMemory, 'failure', tenantId);
      }
      return mapLayerPayloadToForwardView(memoryStore, executionId, previousMatchAttempt.outcome.blockedPayload);
    }
    if (qdrantService && !previousMatchAttempt.outcome.alreadyRecorded) {
      await updateStepQuality(qdrantService, previousMatchAttempt.prevMemory, 'success', tenantId);
    }
    const executionMeta = await forwardRuntimeStore.getExecution(executionId);
    const tensorOut = solutionToTensorValue(input.solution);
    await appendExecutionTrace(
      executionId,
      previousMatchAttempt.prevMemory,
      input.solution,
      executionMeta?.activation_query,
      {},
      tensorOut
    );
    return buildForwardView(memory, executionId, {
      ...(previousMatchAttempt.outcome.proofHash ? { proofHash: previousMatchAttempt.outcome.proofHash } : {}),
      message: 'Applied the submitted solution to the pending prior layer. Continue with the current layer.'
    });
  }

  submissionOutcome = await handleProofSubmission(solutionToUse, memory, {
    expectedPreviousHash: await expectedPreviousHash(memory, qdrantService)
  });
  if (submissionOutcome.blockedPayload) {
    if (qdrantService) {
      await updateStepQuality(qdrantService, memory, 'failure', tenantId);
    }
    return mapLayerPayloadToForwardView(memoryStore, executionId, submissionOutcome.blockedPayload);
  }

  const previousBlock = await ensurePreviousProofCompleted(
    memory,
    (id) => memoryStore.getMemory(id),
    qdrantService,
    executionId
  );
  if (previousBlock) {
    if (qdrantService) {
      await updateStepQuality(qdrantService, memory, 'failure', tenantId);
    }
    const payload = await buildMissingProofPayload(
      memory,
      previousBlock,
      requestedUri,
      memory.memory_uuid,
      (id) => memoryStore.getMemory(id),
      qdrantService,
      executionId
    );
    return mapLayerPayloadToForwardView(memoryStore, executionId, {
      must_obey: payload.retry_count < 3,
      current_step: payload.current_step,
      challenge: payload.challenge,
      message: previousBlock.message,
      next_action: payload.next_action,
      error_code: previousBlock.error_code || 'MISSING_PROOF',
      retry_count: payload.retry_count
    });
  }
  if (qdrantService && !submissionOutcome.alreadyRecorded) {
    await updateStepQuality(qdrantService, memory, 'success', tenantId);
  }

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

  return buildPostSubmissionView({
    memoryStore,
    currentMemory: memory,
    executionId,
    qdrantService,
    ...(submissionOutcome.proofHash ? { proofHash: submissionOutcome.proofHash } : {})
  });
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
