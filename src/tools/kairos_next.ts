/* eslint-disable max-lines */
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
import { proofOfWorkStore } from '../services/proof-of-work-store.js';
import { buildChallenge, handleProofSubmission, tryUserInputElicitation, GENESIS_HASH, type ProofOfWorkSubmission } from './kairos_next-pow-helpers.js';

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

async function buildKairosNextPayload(
  memory: Memory | null,
  requestedUri: string,
  nextInfo?: ResolvedChainStep,
  proof?: ProofOfWorkDefinition
) {
  const current_step = buildCurrentStep(memory, requestedUri);
  const next_step = buildNextStep(memory, nextInfo);
  const protocol_status = next_step ? 'continue' : 'completed';

  const challenge = await buildChallenge(memory, proof);
  const payload: any = {
    must_obey: true as const,
    current_step,
    protocol_status,
    challenge
  };

  if (protocol_status === 'completed') {
    payload.final_challenge = await buildChallenge(memory, proof);
    payload.attest_required = true;
    payload.message = 'Protocol completed. Call kairos_attest to finalize with final_solution.';
    payload.next_action = 'call kairos_attest with final_solution';
  } else {
    payload.next_action = 'call kairos_next with next step uri and solution matching challenge';
  }

  return payload;
}
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
    const proofType = prevProof.type || 'shell';
    let message = `Proof of work missing for ${prevMemory?.label || 'previous step'}.`;
    if (proofType === 'shell') {
      const cmd = prevProof.shell?.cmd || prevProof.cmd || 'the required command';
      message += ` Execute "${cmd}" and report the result before continuing.`;
    } else {
      message += ` Complete the required ${proofType} verification before continuing.`;
    }
    return {
      must_obey: false,
      message,
      protocol_status: 'blocked'
    };
  }
  if (storedResult.status !== 'success') {
    return {
      must_obey: false,
      message: 'Proof of work failed. Fix and retry.',
      protocol_status: 'blocked'
    };
  }
  return null;
}
export function registerKairosNextTool(server: any, memoryStore: MemoryQdrantStore, options: RegisterNextOptions = {}) {
  const toolName = options.toolName || 'kairos_next';
  const memoryUriSchema = z
    .string()
    .regex(/^kairos:\/\/mem\/[0-9a-f-]{36}$/i, 'must match kairos://mem/{uuid}');

  const solutionSchema = z.object({
    type: z.enum(['shell', 'mcp', 'user_input', 'comment']).describe('Must match challenge.type'),
    nonce: z.string().optional().describe('Echo nonce from challenge (required when challenge has nonce)'),
    previousProofHash: z.string().optional().describe('SHA-256 hex of previous step proof, or challenge.genesis_hash for step 1'),
    shell: z.object({
      exit_code: z.number(),
      stdout: z.string().optional(),
      stderr: z.string().optional(),
      duration_seconds: z.number().optional()
    }).optional(),
    mcp: z.object({
      tool_name: z.string(),
      arguments: z.any().optional(),
      result: z.any(),
      success: z.boolean()
    }).optional(),
    user_input: z.object({
      confirmation: z.string(),
      timestamp: z.string().optional()
    }).optional(),
    comment: z.object({ text: z.string() }).optional()
  }).refine(
    (data) => {
      // At least one type-specific field must be present
      return !!(data.shell || data.mcp || data.user_input || data.comment);
    },
    { message: 'At least one type-specific field (shell, mcp, user_input, or comment) must be provided' }
  ).refine(
    (data) => {
      // The type-specific field must match the type
      if (data.type === 'shell' && !data.shell) return false;
      if (data.type === 'mcp' && !data.mcp) return false;
      if (data.type === 'user_input' && !data.user_input) return false;
      if (data.type === 'comment' && !data.comment) return false;
      return true;
    },
    { message: 'The type-specific field must match the solution type' }
  );

  const inputSchema = z.object({
    uri: memoryUriSchema.describe('Current step URI (from next_step of previous response)'),
    solution: solutionSchema.describe('Proof matching challenge.type: shell/mcp/user_input/comment')
  });

  const challengeSchema = z.object({
    type: z.enum(['shell', 'mcp', 'user_input', 'comment']),
    description: z.string(),
    nonce: z.string().optional().describe('Include in solution.nonce'),
    genesis_hash: z.string().optional().describe('Use as solution.previousProofHash for step 1'),
    shell: z.object({
      cmd: z.string(),
      timeout_seconds: z.number()
    }).optional(),
    mcp: z.object({
      tool_name: z.string(),
      expected_result: z.any().optional()
    }).optional(),
    user_input: z.object({
      prompt: z.string().optional()
    }).optional(),
    comment: z.object({
      min_length: z.number().optional()
    }).optional()
  });

  const outputSchema = z.object({
    must_obey: z.boolean(),
    current_step: z.object({
      uri: memoryUriSchema,
      content: z.string(),
      mimeType: z.literal('text/markdown')
    }).optional().nullable(),
    next_step: z.object({
      uri: memoryUriSchema,
      position: z.string(),
      label: z.string()
    }).optional().describe('Present when protocol_status is continue; use this uri for the next kairos_next call'),
    challenge: challengeSchema,
    final_challenge: challengeSchema.optional().describe('Only present on the last step'),
    protocol_status: z.enum(['continue', 'completed', 'blocked']),
    attest_required: z.boolean().optional().describe('When true, indicates kairos_attest should be called to finalize the protocol'),
    message: z.string().optional(),
    next_action: z.string().optional().nullable().describe('Action to take next (e.g., "call kairos_next with next step uri and solution matching challenge")')
  });

  structuredLogger.debug(`kairos_next registration inputSchema: ${JSON.stringify(inputSchema)}`);
  structuredLogger.debug(`kairos_next registration outputSchema: ${JSON.stringify(outputSchema)}`);
  server.registerTool(
    toolName,
    {
      title: 'Submit solution and get next step',
      description: getToolDoc('kairos_next') || 'Submit proof that current challenge was solved. Returns next step + next challenge.',
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
        const { uri, solution } = params as { uri: string; solution: ProofOfWorkSubmission };
        const { uuid, uri: requestedUri } = normalizeMemoryUri(uri);

        // Validate solution is provided
        if (!solution) {
          const noSolChallenge = await buildChallenge(null, undefined);
          return respond({
            must_obey: false,
            current_step: buildCurrentStep(null, requestedUri),
            challenge: noSolChallenge,
            message: 'Solution is required for steps 2+. Use kairos_begin for step 1.',
            protocol_status: 'blocked'
          });
        }

        const memory = await loadMemoryWithCache(memoryStore, uuid);

        let solutionToUse = solution;
        if (memory) {
          const elicitResult = await tryUserInputElicitation(server, memory, solution, requestedUri, buildCurrentStep);
          if ('payload' in elicitResult) return respond(elicitResult.payload);
          solutionToUse = elicitResult.solution;
        }

        if (memory) {
          const isStep1 = !memory.chain || memory.chain.step_index <= 1;
          let expectedPreviousHash: string;
          if (isStep1) {
            expectedPreviousHash = GENESIS_HASH;
          } else {
            const prev = await resolveChainPreviousStep(memory, options.qdrantService);
            const prevHash = prev?.uuid ? await proofOfWorkStore.getProofHash(prev.uuid) : null;
            expectedPreviousHash = prevHash ?? GENESIS_HASH;
          }
          const submissionOutcome = await handleProofSubmission(solutionToUse, memory, { expectedPreviousHash });
          if (submissionOutcome.blockedPayload) {
            const blockedPayload = {
              ...submissionOutcome.blockedPayload,
              current_step: buildCurrentStep(memory, requestedUri),
              challenge: await buildChallenge(memory, memory?.proof_of_work)
            };
            return respond(blockedPayload);
          }

          const previousBlock = await ensurePreviousProofCompleted(memory, memoryStore, options.qdrantService);
          if (previousBlock) {
            const blockedPayload = {
              ...previousBlock,
              current_step: buildCurrentStep(memory, requestedUri),
              challenge: await buildChallenge(memory, memory?.proof_of_work)
            };
            return respond(blockedPayload);
          }
        }

        const nextStepInfo = memory ? await resolveChainNextStep(memory, options.qdrantService) : undefined;
        const nextMemory = nextStepInfo ? await loadMemoryWithCache(memoryStore, nextStepInfo.uuid) : null;
        const displayMemory = nextMemory ?? memory;
        const challengeProof = nextMemory?.proof_of_work ?? memory?.proof_of_work;
        const displayUri = nextStepInfo ? `kairos://mem/${nextStepInfo.uuid}` : requestedUri;
        const nextFromDisplay = displayMemory ? await resolveChainNextStep(displayMemory, options.qdrantService) : undefined;
        const output = await buildKairosNextPayload(displayMemory, displayUri, nextFromDisplay, challengeProof);
        if (output.protocol_status === 'continue' && nextFromDisplay) {
          output.next_step = { uri: `kairos://mem/${nextFromDisplay.uuid}`, position: `${nextFromDisplay.step || 2}/${nextFromDisplay.count || 1}`, label: nextFromDisplay.label || 'Next step' };
        }
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