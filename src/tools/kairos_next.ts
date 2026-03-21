import type { MemoryQdrantStore } from '../services/memory/store.js';
import { z } from 'zod';
import { kairosNextInputSchema, kairosNextOutputSchema } from './kairos_next_schema.js';

export type NextInput = z.infer<typeof kairosNextInputSchema>;
export type NextOutput = z.infer<typeof kairosNextOutputSchema>;
import type { QdrantService } from '../services/qdrant/service.js';
import { structuredLogger } from '../utils/structured-logger.js';
import { resolveChainNextStep, resolveChainPreviousStep } from '../services/chain-utils.js';
import type { Memory, ProofOfWorkDefinition } from '../types/memory.js';
import { redisCacheService } from '../services/redis-cache.js';
import { extractMemoryBody } from '../utils/memory-body.js';
import { proofOfWorkStore } from '../services/proof-of-work-store.js';
import { buildChallenge, handleProofSubmission, GENESIS_HASH, type ProofOfWorkSubmission, type HandleProofResult } from './kairos_next-pow-helpers.js';
import { tryApplySolutionToPreviousStep, tryApplySolutionToPreviousStepWhenSolutionMatchesPrevious, ensurePreviousProofCompleted } from './kairos_next-previous-step.js';
import { buildMissingProofPayload } from './kairos_next-missing-proof-payload.js';
import { modelStats } from '../services/stats/model-stats.js';
import { kairosQualityUpdateErrors } from '../services/metrics/mcp-metrics.js';

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
    payload.message = 'Protocol steps complete. Call kairos_attest to finalize.';
    payload.next_action = `call kairos_attest with ${requestedUri} and outcome (success or failure) and message to complete the protocol`;
  }

  return payload;
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

export type TryElicitResult = { payload: NextOutput } | { solution: ProofOfWorkSubmission };

/**
 * Shared execute: submit solution and return next step/challenge. Used by MCP tool and HTTP route.
 * When tryElicit is provided (MCP), user_input elicitation may return a payload or adjusted solution.
 */
export async function executeNext(
  memoryStore: MemoryQdrantStore,
  qdrantService: QdrantService | undefined,
  input: NextInput,
  tenantId: string,
  options?: { tryElicit?: (memory: Memory, solution: ProofOfWorkSubmission, requestedUri: string) => Promise<TryElicitResult> }
): Promise<NextOutput> {
  const { uri, solution } = input;
  const { uuid, uri: requestedUri } = normalizeMemoryUri(uri);
  const memory = await loadMemoryWithCache(memoryStore, uuid);

  let solutionToUse = solution;
  if (memory && options?.tryElicit) {
    const elicitResult = await options.tryElicit(memory, solution as ProofOfWorkSubmission, requestedUri);
    if ('payload' in elicitResult) return elicitResult.payload;
    solutionToUse = elicitResult.solution;
  }

  let submissionOutcome: HandleProofResult | undefined;
  if (memory) {
    if (!memory.proof_of_work && solutionToUse) {
      const prevResult = await tryApplySolutionToPreviousStep(
        memory,
        solutionToUse as ProofOfWorkSubmission,
        (id) => loadMemoryWithCache(memoryStore, id),
        qdrantService
      );
      if (prevResult.applied) {
        if (prevResult.outcome.blockedPayload) {
          if (qdrantService) await updateStepQuality(qdrantService, prevResult.prevMemory, 'failure', tenantId);
          return prevResult.outcome.blockedPayload as NextOutput;
        }
        const previousBlock = await ensurePreviousProofCompleted(
          memory,
          (id) => loadMemoryWithCache(memoryStore, id),
          qdrantService
        );
        if (!previousBlock && qdrantService && !prevResult.outcome.alreadyRecorded) {
          await updateStepQuality(qdrantService, prevResult.prevMemory, 'success', tenantId);
        }
        if (!previousBlock) {
          const nextFromRequested = await resolveChainNextStep(memory, qdrantService);
          const nextStepUri = nextFromRequested?.uuid ? `kairos://mem/${nextFromRequested.uuid}` : null;
          const output = (await buildKairosNextPayload(memory, requestedUri, nextStepUri, undefined)) as NextOutput;
          if (prevResult.outcome.proofHash) output.proof_hash = prevResult.outcome.proofHash;
          return output;
        }
      }
    }

    if (memory.proof_of_work && solutionToUse) {
      const prevResultWhenMatch = await tryApplySolutionToPreviousStepWhenSolutionMatchesPrevious(
        memory,
        solutionToUse as ProofOfWorkSubmission,
        (id) => loadMemoryWithCache(memoryStore, id),
        qdrantService
      );
      if (prevResultWhenMatch.applied) {
        if (prevResultWhenMatch.outcome.blockedPayload) {
          if (qdrantService) await updateStepQuality(qdrantService, prevResultWhenMatch.prevMemory, 'failure', tenantId);
          return prevResultWhenMatch.outcome.blockedPayload as NextOutput;
        }
        if (qdrantService && !prevResultWhenMatch.outcome.alreadyRecorded) {
          await updateStepQuality(qdrantService, prevResultWhenMatch.prevMemory, 'success', tenantId);
        }
        const nextFromRequested = await resolveChainNextStep(memory, qdrantService);
        const nextStepUri = nextFromRequested?.uuid ? `kairos://mem/${nextFromRequested.uuid}` : null;
        const nextMemory = nextFromRequested ? await loadMemoryWithCache(memoryStore, nextFromRequested.uuid) : null;
        const challengeProof = nextMemory?.proof_of_work ?? memory?.proof_of_work;
        const output = (await buildKairosNextPayload(memory, requestedUri, nextStepUri, challengeProof)) as NextOutput;
        if (prevResultWhenMatch.outcome.proofHash) output.proof_hash = prevResultWhenMatch.outcome.proofHash;
        return output;
      }
    }

    const isStep1 = !memory.chain || memory.chain.step_index <= 1;
    let expectedPreviousHash: string;
    if (isStep1) {
      expectedPreviousHash = GENESIS_HASH;
    } else {
      const prev = await resolveChainPreviousStep(memory, qdrantService);
      const prevHash = prev?.uuid ? await proofOfWorkStore.getProofHash(prev.uuid) : null;
      expectedPreviousHash = prevHash ?? GENESIS_HASH;
    }
    submissionOutcome = await handleProofSubmission(solutionToUse as ProofOfWorkSubmission, memory, { expectedPreviousHash });
    if (submissionOutcome.blockedPayload) {
      if (qdrantService) await updateStepQuality(qdrantService, memory, 'failure', tenantId);
      return submissionOutcome.blockedPayload as NextOutput;
    }

    const previousBlock = await ensurePreviousProofCompleted(
      memory,
      (id) => loadMemoryWithCache(memoryStore, id),
      qdrantService
    );
    if (previousBlock) {
      if (qdrantService) await updateStepQuality(qdrantService, memory, 'failure', tenantId);
      const payload = await buildMissingProofPayload(
        memory,
        previousBlock,
        requestedUri,
        uuid,
        (id) => loadMemoryWithCache(memoryStore, id),
        qdrantService
      );
      return {
        must_obey: payload.retry_count < 3,
        current_step: payload.current_step,
        challenge: payload.challenge,
        message: previousBlock.message,
        next_action: payload.next_action,
        error_code: previousBlock.error_code || 'MISSING_PROOF',
        retry_count: payload.retry_count
      };
    }
    if (qdrantService && !submissionOutcome.alreadyRecorded) {
      await updateStepQuality(qdrantService, memory, 'success', tenantId);
    }
  }

  const nextStepInfo = memory ? await resolveChainNextStep(memory, qdrantService) : undefined;
  const nextMemory = nextStepInfo ? await loadMemoryWithCache(memoryStore, nextStepInfo.uuid) : null;
  const displayMemory = nextMemory ?? memory ?? null;
  const challengeProof = nextMemory?.proof_of_work ?? memory?.proof_of_work;
  const displayUri = nextStepInfo ? `kairos://mem/${nextStepInfo.uuid}` : requestedUri;
  const nextFromDisplay = displayMemory ? await resolveChainNextStep(displayMemory, qdrantService) : undefined;
  const nextStepUri = nextFromDisplay?.uuid ? `kairos://mem/${nextFromDisplay.uuid}` : null;
  const output = (await buildKairosNextPayload(displayMemory, displayUri, nextStepUri, challengeProof)) as NextOutput;
  if (submissionOutcome?.proofHash) output.proof_hash = submissionOutcome.proofHash;
  return output;
}
