import type { MemoryQdrantStore } from '../services/memory/store.js';
import { kairosNextInputSchema, kairosNextOutputSchema } from './kairos_next_schema.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { structuredLogger } from '../utils/structured-logger.js';
import { resolveChainNextStep, resolveChainPreviousStep } from '../services/chain-utils.js';
import { getToolDoc } from '../resources/embedded-mcp-resources.js';
import { mcpToolCalls, mcpToolDuration, mcpToolErrors, mcpToolInputSize, mcpToolOutputSize } from '../services/metrics/mcp-metrics.js';
import { getTenantId } from '../utils/tenant-context.js';
import type { Memory, ProofOfWorkDefinition } from '../types/memory.js';
import { redisCacheService } from '../services/redis-cache.js';
import { extractMemoryBody } from '../utils/memory-body.js';
import { proofOfWorkStore } from '../services/proof-of-work-store.js';
import { buildChallenge, handleProofSubmission, tryUserInputElicitation, GENESIS_HASH, type ProofOfWorkSubmission } from './kairos_next-pow-helpers.js';
import { modelStats } from '../services/stats/model-stats.js';
import { kairosQualityUpdateErrors } from '../services/metrics/mcp-metrics.js';

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

async function buildKairosNextPayload(
  memory: Memory | null,
  requestedUri: string,
  nextStepUri: string | null,
  proof?: ProofOfWorkDefinition
) {
  const current_step = buildCurrentStep(memory, requestedUri);
  const challenge = await buildChallenge(memory, proof);

  const payload: any = {
    must_obey: true as const,
    current_step,
    challenge
  };

  if (nextStepUri) {
    payload.next_action = `call kairos_next with ${nextStepUri} and solution matching challenge`;
  } else {
    const attestUri = memory ? `kairos://mem/${memory.memory_uuid}` : requestedUri;
    payload.message = 'Protocol completed. No further steps.';
    payload.next_action = `Run complete. Optionally call kairos_attest with ${attestUri} to override outcome or add a message.`;
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
    return { message, error_code: 'MISSING_PROOF' };
  }
  if (storedResult.status !== 'success') {
    return { message: 'Previous step proof failed. Fix and retry.', error_code: 'COMMAND_FAILED' };
  }
  return null;
}

/** Update quality_metadata and quality_metrics for the completed step. Log and continue on error; do not fail the request. Shared by MCP and HTTP kairos_next. */
export async function updateStepQuality(
  qdrantService: QdrantService,
  memory: Memory,
  outcome: 'success' | 'failure',
  tenantId: string
): Promise<void> {
  try {
    const qdrantUuid = memory.memory_uuid;
    const currentPoint = await qdrantService.retrieveById(qdrantUuid);
    const payload = currentPoint?.payload as Record<string, unknown> | undefined;
    const description_short = (payload?.['description_short'] as string) || 'Knowledge step';
    const domain = (payload?.['domain'] as string) || 'general';
    const task = (payload?.['task'] as string) || 'general';
    const type = (payload?.['type'] as string) || 'context';
    const tags = Array.isArray(payload?.['tags']) ? (payload!['tags'] as string[]) : [];

    const metricsUpdate = {
      retrievalCount: 1,
      successCount: outcome === 'success' ? 1 : 0,
      failureCount: outcome === 'failure' ? 1 : 0,
      lastRated: new Date().toISOString(),
      lastRater: 'kairos_next',
      qualityBonus: outcome === 'success' ? 1 : -0.2
    };
    await qdrantService.updateQualityMetrics(qdrantUuid, metricsUpdate);

    const updatedQualityMetadata = modelStats.calculateStepQualityMetadata(
      description_short,
      domain,
      task,
      type,
      tags,
      outcome
    );
    await qdrantService.updateQualityMetadata(qdrantUuid, {
      step_quality_score: updatedQualityMetadata.step_quality_score,
      step_quality: updatedQualityMetadata.step_quality
    });
    structuredLogger.debug(`kairos_next: Updated quality for ${memory.memory_uuid} outcome=${outcome}`);
  } catch (err) {
    kairosQualityUpdateErrors.inc({ tenant_id: tenantId });
    structuredLogger.warn(`kairos_next: Quality update failed for ${memory.memory_uuid}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export function registerKairosNextTool(server: any, memoryStore: MemoryQdrantStore, options: RegisterNextOptions = {}) {
  const toolName = options.toolName || 'kairos_next';
  structuredLogger.debug(`kairos_next registration inputSchema: ${JSON.stringify(kairosNextInputSchema)}`);
  structuredLogger.debug(`kairos_next registration outputSchema: ${JSON.stringify(kairosNextOutputSchema)}`);
  server.registerTool(
    toolName,
    {
      title: 'Submit solution and get next step',
      description: getToolDoc('kairos_next') || 'Submit proof that current challenge was solved. Returns next step + next challenge.',
      inputSchema: kairosNextInputSchema,
      outputSchema: kairosNextOutputSchema
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
          const retryCount = await proofOfWorkStore.incrementRetry(uuid);
          const noSolChallenge = await buildChallenge(null, undefined);
          return respond({
            must_obey: retryCount < 3,
            current_step: buildCurrentStep(null, requestedUri),
            challenge: noSolChallenge,
            message: 'Solution is required for steps 2+. Use kairos_begin for step 1.',
            next_action: `retry kairos_next with ${requestedUri} -- include solution matching challenge`,
            error_code: 'MISSING_FIELD',
            retry_count: retryCount
          });
        }

        const memory = await loadMemoryWithCache(memoryStore, uuid);

        let solutionToUse = solution;
        if (memory) {
          const elicitResult = await tryUserInputElicitation(server, memory, solution, requestedUri, buildCurrentStep);
          if ('payload' in elicitResult) return respond(elicitResult.payload);
          solutionToUse = elicitResult.solution;
        }

        let submissionOutcome: { proofHash?: string; blockedPayload?: any } | undefined;
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
          submissionOutcome = await handleProofSubmission(solutionToUse, memory, { expectedPreviousHash });
          if (submissionOutcome.blockedPayload) {
            if (options.qdrantService) {
              await updateStepQuality(options.qdrantService, memory, 'failure', tenantId);
            }
            return respond(submissionOutcome.blockedPayload);
          }

          const previousBlock = await ensurePreviousProofCompleted(memory, memoryStore, options.qdrantService);
          if (previousBlock) {
            if (options.qdrantService) {
              await updateStepQuality(options.qdrantService, memory, 'failure', tenantId);
            }
            const retryCount = await proofOfWorkStore.incrementRetry(uuid);
            const blockedPayload = {
              must_obey: retryCount < 3,
              current_step: buildCurrentStep(memory, requestedUri),
              challenge: await buildChallenge(memory, memory?.proof_of_work),
              message: previousBlock.message,
              next_action: `retry kairos_next with ${requestedUri} -- complete previous step first`,
              error_code: previousBlock.error_code || 'MISSING_PROOF',
              retry_count: retryCount
            };
            return respond(blockedPayload);
          }

          if (options.qdrantService) {
            await updateStepQuality(options.qdrantService, memory, 'success', tenantId);
          }
        }

        // Resolve next step
        const nextStepInfo = memory ? await resolveChainNextStep(memory, options.qdrantService) : undefined;
        const nextMemory = nextStepInfo ? await loadMemoryWithCache(memoryStore, nextStepInfo.uuid) : null;
        const displayMemory = nextMemory ?? memory;
        const challengeProof = nextMemory?.proof_of_work ?? memory?.proof_of_work;
        const displayUri = nextStepInfo ? `kairos://mem/${nextStepInfo.uuid}` : requestedUri;

        // First run is not a retry: reset retry for the step we're presenting so the first submission in this run is never counted as a retry (fixes MAX_RETRIES_EXCEEDED on first valid submission).
        if (displayMemory?.memory_uuid) {
          await proofOfWorkStore.resetRetry(displayMemory.memory_uuid);
        }

        // Resolve the step AFTER the display step to get next_action URI
        const nextFromDisplay = displayMemory ? await resolveChainNextStep(displayMemory, options.qdrantService) : undefined;
        const nextStepUri = nextFromDisplay?.uuid
          ? `kairos://mem/${nextFromDisplay.uuid}`
          : null;

        const output = await buildKairosNextPayload(displayMemory, displayUri, nextStepUri, challengeProof);

        if (submissionOutcome?.proofHash) {
          output.proof_hash = submissionOutcome.proofHash;
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
