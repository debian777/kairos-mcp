import type { InferenceContractDefinition, Memory } from '../types/memory.js';
import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { extractMemoryBody } from '../utils/memory-body.js';
import { buildChallenge, type ProofOfWorkSubmission } from './kairos_next-pow-helpers.js';
import type { executeNext } from './kairos_next.js';
import { forwardRuntimeStore } from '../services/forward-runtime-store.js';
import type { ForwardOutput, ForwardSolution } from './forward_schema.js';
import { buildLayerUri, parseKairosUri } from './v10-uri.js';

export function extractUuid(uri: string): string {
  return uri.split('/').pop()?.split('?')[0] ?? '';
}

export function legacyCurrentStep(memory: Memory, uri: string) {
  return {
    uri,
    content: extractMemoryBody(memory.text),
    mimeType: 'text/markdown' as const
  };
}

function currentLayer(memory: Memory, executionId: string) {
  return {
    uri: buildLayerUri(memory.memory_uuid, executionId),
    content: extractMemoryBody(memory.text),
    mimeType: 'text/markdown' as const
  };
}

export function normalizeContract(memory: Memory): InferenceContractDefinition | undefined {
  return memory.inference_contract ?? memory.proof_of_work;
}

function summarizeContract(contract: InferenceContractDefinition): string {
  if (contract.type === 'tensor') {
    const outputName = contract.tensor?.output.name ?? 'tensor';
    const outputType = contract.tensor?.output.type ?? 'unknown';
    return `Produce tensor ${outputName} (${outputType})`;
  }
  if (contract.type === 'shell') {
    return `Execute shell command: ${contract.shell?.cmd ?? contract.cmd ?? 'unknown command'}`;
  }
  if (contract.type === 'mcp') {
    return `Call MCP tool: ${contract.mcp?.tool_name ?? 'unknown tool'}`;
  }
  if (contract.type === 'user_input') {
    return `Collect user input: ${contract.user_input?.prompt ?? 'confirmation required'}`;
  }
  return `Provide a verification comment (${contract.comment?.min_length ?? 10}+ chars)`;
}

export function mapProofSolution(solution: ForwardSolution): ProofOfWorkSubmission {
  return {
    type: solution.type as ProofOfWorkSubmission['type'],
    ...(solution.nonce ? { nonce: solution.nonce } : {}),
    ...(solution.proof_hash ? { proof_hash: solution.proof_hash } : {}),
    ...(solution.shell && {
      shell: {
        exit_code: solution.shell.exit_code,
        ...(solution.shell.stdout !== undefined ? { stdout: solution.shell.stdout } : {}),
        ...(solution.shell.stderr !== undefined ? { stderr: solution.shell.stderr } : {}),
        ...(solution.shell.duration_seconds !== undefined ? { duration_seconds: solution.shell.duration_seconds } : {})
      }
    }),
    ...(solution.mcp && { mcp: solution.mcp }),
    ...(solution.user_input && {
      user_input: {
        confirmation: solution.user_input.confirmation,
        ...(solution.user_input.timestamp !== undefined ? { timestamp: solution.user_input.timestamp } : {})
      }
    }),
    ...(solution.comment && { comment: solution.comment })
  };
}

export async function loadMemoryForParsedUri(
  memoryStore: MemoryQdrantStore,
  qdrantService: QdrantService | undefined,
  parsed: ReturnType<typeof parseKairosUri>
): Promise<Memory | null> {
  if (parsed.kind === 'layer') {
    return memoryStore.getMemory(parsed.id);
  }

  if (!qdrantService) {
    throw new Error('Adapter resolution requires qdrantService');
  }

  const layers = await qdrantService.getChainMemories(parsed.id);
  const firstLayer = layers[0]?.uuid;
  if (firstLayer) {
    return memoryStore.getMemory(firstLayer);
  }

  return memoryStore.getMemory(parsed.id);
}

async function buildContractResponse(
  memory: Memory,
  executionId: string
): Promise<{ contract: ForwardOutput['contract']; tensorIn?: Record<string, unknown> }> {
  const storedContract = normalizeContract(memory);
  if (!storedContract) {
    const fallback = await buildChallenge(memory, undefined);
    return { contract: fallback };
  }

  if (storedContract.type === 'tensor') {
    const requiredInputs = storedContract.tensor?.required_inputs ?? [];
    const tensorIn = executionId
      ? await forwardRuntimeStore.requireTensorInputs(executionId, requiredInputs)
      : {};
    return {
      contract: {
        type: 'tensor',
        required: storedContract.required,
        description: summarizeContract(storedContract),
        tensor: storedContract.tensor
      },
      tensorIn
    };
  }

  const challenge = await buildChallenge(memory, storedContract);
  return { contract: challenge };
}

function finalContract(): ForwardOutput['contract'] {
  return {
    type: 'comment',
    required: false,
    description: 'Execution complete. Call reward to finalize.'
  };
}

export type BuildForwardViewOptions = {
  final?: boolean;
  message?: string;
  proofHash?: string;
  errorCode?: string;
  retryCount?: number;
  mustObey?: boolean;
  contractOverride?: ForwardOutput['contract'];
  tensorInOverride?: Record<string, unknown>;
};

export async function buildForwardView(
  memory: Memory,
  executionId: string,
  options?: BuildForwardViewOptions
): Promise<ForwardOutput> {
  const { contract, tensorIn } = options?.contractOverride
    ? { contract: options.contractOverride, tensorIn: options.tensorInOverride }
    : options?.final
      ? { contract: finalContract(), tensorIn: undefined }
      : await buildContractResponse(memory, executionId);
  const layer = currentLayer(memory, executionId);
  const final = options?.final === true;

  return {
    must_obey: options?.mustObey ?? true,
    current_layer: layer,
    contract,
    ...(tensorIn && Object.keys(tensorIn).length > 0 ? { tensor_in: tensorIn } : {}),
    next_action: final
      ? `call reward with ${layer.uri} and outcome (success or failure) and feedback to complete the adapter`
      : `call forward with ${layer.uri} and solution matching contract`,
    execution_id: executionId,
    ...(options?.proofHash && { proof_hash: options.proofHash }),
    ...(options?.message && { message: options.message }),
    ...(options?.errorCode && { error_code: options.errorCode }),
    ...(options?.retryCount !== undefined && { retry_count: options.retryCount })
  };
}

export async function mapLegacyForwardOutput(
  memoryStore: MemoryQdrantStore,
  executionId: string,
  legacyOutput: Awaited<ReturnType<typeof executeNext>>
): Promise<ForwardOutput> {
  const currentLayerId = legacyOutput.current_step?.uri ? extractUuid(legacyOutput.current_step.uri) : '';
  const displayMemory = currentLayerId ? await memoryStore.getMemory(currentLayerId) : null;
  if (!displayMemory || !legacyOutput.current_step) {
    throw new Error('Legacy next output did not include a resolvable current_step');
  }

  const final = legacyOutput.next_action.includes('kairos_attest');
  const displayContract = normalizeContract(displayMemory);
  const options: BuildForwardViewOptions = {
    final,
    ...(legacyOutput.message
      ? {
          message: legacyOutput.message
            .replaceAll('protocol', 'adapter')
            .replaceAll('Protocol', 'Adapter')
            .replaceAll('kairos_attest', 'reward')
            .replaceAll('kairos_next', 'forward')
        }
      : {}),
    ...(legacyOutput.proof_hash ? { proofHash: legacyOutput.proof_hash } : {}),
    ...(legacyOutput.error_code ? { errorCode: legacyOutput.error_code } : {}),
    ...(legacyOutput.retry_count !== undefined ? { retryCount: legacyOutput.retry_count } : {}),
    mustObey: legacyOutput.must_obey,
    ...(!final && displayContract?.type !== 'tensor' && { contractOverride: legacyOutput.challenge })
  };
  return buildForwardView(displayMemory, executionId, options);
}
