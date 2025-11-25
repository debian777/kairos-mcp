import { z } from 'zod';
import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { structuredLogger } from '../utils/structured-logger.js';
import { resolveChainNextStep, resolveChainPreviousStep, type ResolvedChainStep } from '../services/chain-utils.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';
import { mcpToolCalls, mcpToolDuration, mcpToolErrors, mcpToolInputSize, mcpToolOutputSize } from '../services/metrics/mcp-metrics.js';
import { getTenantId } from '../utils/tenant-context.js';
import type { Memory, ProofOfWorkDefinition } from '../types/memory.js';
import { redisCacheService } from '../services/redis-cache.js';
import { extractMemoryBody } from '../utils/memory-body.js';
import { proofOfWorkStore, type ProofOfWorkResultRecord, type ProofOfWorkStatus } from '../services/proof-of-work-store.js';

interface RegisterNextOptions {
  toolName?: string;
  qdrantService?: QdrantService;
}

async function loadMemoryWithCache(memoryStore: MemoryQdrantStore, uuid: string): Promise<Memory | null> {
  const cached = await redisCacheService.getMemoryResource(uuid);
  if (cached) {
    return cached;
  }
  const memory = await memoryStore.getMemory(uuid);
  if (memory) {
    await redisCacheService.setMemoryResource(memory);
  }
  return memory;
}
function normalizeMemoryUri(value: string): { uuid: string; uri: string } {
  const normalized = (value || '').trim();
  const uuid = normalized.split('/').pop();
  if (!uuid) {
    throw new Error('Invalid kairos://mem URI');
  }
  const uri = normalized.startsWith('kairos://mem/')
    ? normalized
    : `kairos://mem/${uuid}`;
  return { uuid, uri };
}

function buildCurrentStep(memory: Memory | null, requestedUri: string) {
  const uri = memory ? `kairos://mem/${memory.memory_uuid}` : requestedUri;
  const content = memory ? extractMemoryBody(memory.text) : '';
  return {
    uri,
    content,
    mimeType: 'text/markdown' as const
  };
}
function buildNextStep(
  memory: Memory | null,
  nextInfo?: ResolvedChainStep
): { uri: string; position: string; label: string } | null {
  if (!memory || !nextInfo || !nextInfo.uuid) {
    return null;
  }

  const total = Math.max(nextInfo.count ?? memory.chain?.step_count ?? 1, 1);
  const stepIndex = Math.max(nextInfo.step ?? (memory.chain ? memory.chain.step_index + 1 : 1), 1);

  return {
    uri: `kairos://mem/${nextInfo.uuid}`,
    position: `${stepIndex}/${total}`,
    label: nextInfo.label || 'Next step'
  };
}

function buildKairosNextPayload(
  memory: Memory | null,
  requestedUri: string,
  nextInfo?: ResolvedChainStep,
  proof?: ProofOfWorkDefinition,
  proofResult?: ProofOfWorkResultRecord | null
) {
  const current_step = buildCurrentStep(memory, requestedUri);
  const next_step = buildNextStep(memory, nextInfo);
  const protocol_status = next_step ? 'continue' : 'completed';

  const payload: any = {
    must_obey: true as const,
    current_step,
    next_step,
    protocol_status
  };

  if (proof) {
    payload.proof_of_work = {
      cmd: proof.cmd,
      timeout_seconds: proof.timeout_seconds
    };
  }

  if (proofResult) {
    const formatted: {
      result_id?: string;
      status: ProofOfWorkStatus;
      exit_code: number;
      executed_at?: string;
      duration_seconds?: number;
      stdout?: string;
      stderr?: string;
    } = {
      status: proofResult.status,
      exit_code: proofResult.exit_code
    };
    if (proofResult.result_id) formatted.result_id = proofResult.result_id;
    if (proofResult.executed_at) formatted.executed_at = proofResult.executed_at;
    if (typeof proofResult.duration_seconds === 'number') formatted.duration_seconds = proofResult.duration_seconds;
    if (proofResult.stdout) formatted.stdout = proofResult.stdout;
    if (proofResult.stderr) formatted.stderr = proofResult.stderr;
    payload.proof_of_work_result = formatted;
  }

  return payload;
}
type ProofSubmissionPayload = { uri: string; exit_code: number; stdout?: string; stderr?: string; duration_seconds?: number; executed_at?: string };
async function ensurePreviousProofCompleted(
  memory: Memory,
  memoryStore: MemoryQdrantStore,
  qdrantService?: QdrantService
): Promise<any | null> {
  if (!memory?.chain || memory.chain.step_index <= 1) {
    return null;
  }
  const previous = await resolveChainPreviousStep(memory, qdrantService);
  if (!previous?.uuid) {
    return null;
  }
  const prevMemory = await loadMemoryWithCache(memoryStore, previous.uuid);
  const prevProof = prevMemory?.proof_of_work;
  if (!prevProof || !prevProof.required) {
    return null;
  }
  const storedResult = await proofOfWorkStore.getResult(previous.uuid);
  if (!storedResult) {
    return {
      must_obey: false,
      message: `Proof of work missing for ${prevMemory?.label || 'previous step'}. Execute "${prevProof.cmd}" and report the result before continuing.`,
      protocol_status: 'blocked'
    };
  }
  if (storedResult.status !== 'success') {
    return {
      must_obey: false,
      proof_of_work_result: {
        status: storedResult.status,
        exit_code: storedResult.exit_code
      },
      message: 'Proof of work failed. Fix and retry.',
      protocol_status: 'blocked'
    };
  }
  return null;
}
async function handleProofSubmission(
  submission: ProofSubmissionPayload,
  memoryStore: MemoryQdrantStore
): Promise<{ blockedPayload?: any }> {
  if (!submission?.uri) {
    return {};
  }
  const { uuid } = normalizeMemoryUri(submission.uri);
  const memory = await loadMemoryWithCache(memoryStore, uuid);
  if (!memory?.proof_of_work) {
    return {};
  }
  const record: ProofOfWorkResultRecord = {
    result_id: `pow_${uuid}_${Date.now()}`,
    status: submission.exit_code === 0 ? 'success' : 'failed',
    exit_code: submission.exit_code,
    executed_at: submission.executed_at || new Date().toISOString()
  };
  if (typeof submission.duration_seconds === 'number') {
    record.duration_seconds = submission.duration_seconds;
  }
  if (submission.stdout) {
    record.stdout = submission.stdout;
  }
  if (submission.stderr) {
    record.stderr = submission.stderr;
  }
  await proofOfWorkStore.saveResult(uuid, record);

  if (memory.proof_of_work.required && record.status === 'failed') {
    return {
      blockedPayload: {
        must_obey: false,
        proof_of_work_result: {
          status: 'failed',
          exit_code: submission.exit_code
        },
        message: 'Proof of work failed. Fix and retry.',
        protocol_status: 'blocked'
      }
    };
  }

  return {};
}
export function registerKairosNextTool(server: any, memoryStore: MemoryQdrantStore, options: RegisterNextOptions = {}) {
  const toolName = options.toolName || 'kairos_next';

  const proofSubmissionSchema = z.object({
    uri: z.string().min(1).describe('URI of the step that produced this result'),
    exit_code: z.number().describe('Exit code from the proof-of-work command'),
    stdout: z.string().optional().describe('Captured stdout (optional)'),
    stderr: z.string().optional().describe('Captured stderr (optional)'),
    duration_seconds: z.number().optional().describe('Execution duration in seconds'),
    executed_at: z.string().optional().describe('ISO timestamp when command completed')
  });

  const inputSchema = z.object({
    uri: z.string().min(1).describe('URI of the current memory step'),
    proof_of_work_result: proofSubmissionSchema.optional().describe('Optional proof-of-work submission for a completed step')
  });

  const proofResultSchema = z.object({
    result_id: z.string().optional(),
    status: z.enum(['success', 'failed']),
    exit_code: z.number(),
    executed_at: z.string().optional(),
    duration_seconds: z.number().optional(),
    stdout: z.string().optional(),
    stderr: z.string().optional()
  });

  const outputSchema = z.object({
    must_obey: z.boolean(),
    current_step: z.object({
      uri: z.string().regex(/^kairos:\/\/mem\/[0-9a-f-]{36}$/i),
      content: z.string(),
      mimeType: z.literal('text/markdown')
    }).optional().nullable(),
    next_step: z.union([
      z.object({
        uri: z.string().regex(/^kairos:\/\/mem\/[0-9a-f-]{36}$/i),
        position: z.string().regex(/^\d+\/\d+$/),
        label: z.string().min(1)
      }),
      z.null()
    ]).optional().nullable(),
    proof_of_work: z.object({
      cmd: z.string(),
      timeout_seconds: z.number()
    }).optional().nullable(),
    proof_of_work_result: proofResultSchema.optional().nullable(),
    protocol_status: z.enum(['continue', 'completed', 'blocked']),
    message: z.string().optional()
  });

  structuredLogger.debug(`kairos_next registration inputSchema: ${JSON.stringify(inputSchema)}`);
  structuredLogger.debug(`kairos_next registration outputSchema: ${JSON.stringify(outputSchema)}`);
  server.registerTool(
    toolName,
    {
      title: 'Get next step in chain',
      description: getToolDoc('kairos_next'),
      inputSchema,
      outputSchema
    },
    async (params: any) => {
      const tenantId = getTenantId();
      const inputSize = JSON.stringify(params).length;
      mcpToolInputSize.observe({ tool: toolName, tenant_id: tenantId }, inputSize);
      
      const timer = mcpToolDuration.startTimer({ 
        tool: toolName,
        tenant_id: tenantId 
      });
      const respond = (payload: any) => {
        const structured = {
          content: [{
            type: 'text', text: JSON.stringify(payload)
          }],
          structuredContent: payload
        };
        mcpToolCalls.inc({ 
          tool: toolName, 
          status: 'success',
          tenant_id: tenantId 
        });
        const outputSize = JSON.stringify(structured).length;
        mcpToolOutputSize.observe({ tool: toolName, tenant_id: tenantId }, outputSize);
        timer({ 
          tool: toolName, 
          status: 'success',
          tenant_id: tenantId 
        });
        return structured;
      };
      try {
        const { uri, proof_of_work_result: submission } = params as { uri: string; proof_of_work_result?: ProofSubmissionPayload };
        const { uuid, uri: requestedUri } = normalizeMemoryUri(uri);

        if (submission) {
          const submissionOutcome = await handleProofSubmission(submission, memoryStore);
          if (submissionOutcome.blockedPayload) {
            return respond(submissionOutcome.blockedPayload);
          }
        }

        const memory = await loadMemoryWithCache(memoryStore, uuid);
        if (memory) {
          const previousBlock = await ensurePreviousProofCompleted(memory, memoryStore, options.qdrantService);
          if (previousBlock) {
            return respond(previousBlock);
          }
        }

        const nextStepInfo = memory
          ? await resolveChainNextStep(memory, options.qdrantService)
          : undefined;
        const proofResult = memory ? await proofOfWorkStore.getResult(memory.memory_uuid) : null;

        const output = buildKairosNextPayload(memory, requestedUri, nextStepInfo, memory?.proof_of_work, proofResult);
        return respond(output);
      } catch (error) {
        mcpToolCalls.inc({ 
          tool: toolName, 
          status: 'error',
          tenant_id: tenantId 
        });
        mcpToolErrors.inc({ 
          tool: toolName, 
          status: 'error',
          tenant_id: tenantId 
        });
        timer({ 
          tool: toolName, 
          status: 'error',
          tenant_id: tenantId 
        });
        throw error;
      }
    }
  );
}