/**
 * MISSING_PROOF fix: when the requested step has no proof_of_work, apply the solution to the previous step.
 * Shared by MCP (kairos_next) and HTTP (http-api-next).
 */

import type { Memory } from '../types/memory.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { resolveChainPreviousStep } from '../services/chain-utils.js';
import { proofOfWorkStore } from '../services/proof-of-work-store.js';
import { handleProofSubmission, GENESIS_HASH, type ProofOfWorkSubmission, type HandleProofResult } from './kairos_next-pow-helpers.js';

export type PreviousProofBlock = {
  message: string;
  error_code: string;
  next_action?: string;
};

export type TryApplyToPreviousResult =
  | { applied: true; outcome: HandleProofResult; prevMemory: Memory }
  | { applied: false };

/**
 * If the requested step has no proof_of_work and the previous step has required proof, validate and store
 * the solution against the previous step. Returns { applied: true, outcome, prevMemory } when applied
 * (caller must then check ensurePreviousProofCompleted and build response), or { applied: false }.
 */
export async function tryApplySolutionToPreviousStep(
  memory: Memory,
  solution: ProofOfWorkSubmission,
  loadMemory: (uuid: string) => Promise<Memory | null>,
  qdrantService: QdrantService | undefined
): Promise<TryApplyToPreviousResult> {
  if (memory.proof_of_work) return { applied: false };
  const prevInfo = await resolveChainPreviousStep(memory, qdrantService);
  const prevMemory = prevInfo?.uuid ? await loadMemory(prevInfo.uuid) : null;
  if (!prevMemory?.proof_of_work?.required) return { applied: false };

  const prevIsStep1 = !prevMemory.chain || prevMemory.chain.step_index <= 1;
  const expectedPrevHash = prevIsStep1
    ? GENESIS_HASH
    : (await (async () => {
        const p = await resolveChainPreviousStep(prevMemory, qdrantService);
        return p?.uuid ? await proofOfWorkStore.getProofHash(p.uuid) : null;
      })()) ?? GENESIS_HASH;

  const outcome = await handleProofSubmission(solution, prevMemory, {
    expectedPreviousHash: expectedPrevHash
  });
  return { applied: true, outcome, prevMemory };
}

export async function ensurePreviousProofCompleted(
  memory: Memory,
  loadMemory: (uuid: string) => Promise<Memory | null>,
  qdrantService: QdrantService | undefined
): Promise<PreviousProofBlock | null> {
  if (!memory?.chain || memory.chain.step_index <= 1) return null;
  const previous = await resolveChainPreviousStep(memory, qdrantService);
  if (!previous?.uuid) return null;
  const prevMemory = await loadMemory(previous.uuid);
  const prevProof = prevMemory?.proof_of_work;
  if (!prevProof || !prevProof.required) return null;
  const storedResult = await proofOfWorkStore.getResult(previous.uuid);
  if (!storedResult) {
    const proofType = prevProof.type || 'shell';
    const stepLabel = prevMemory?.label || 'previous step';
    const prevStepUri = `kairos://mem/${previous.uuid}`;
    let message = `Proof of work missing for ${stepLabel}.`;
    let next_action: string | undefined;
    if (proofType === 'shell') {
      const cmd = prevProof.shell?.cmd || prevProof.cmd || 'the required command';
      message += ` Execute "${cmd}" and report the result before continuing.`;
      next_action = `Execute "${prevProof.shell?.cmd || prevProof.cmd || cmd}", then call kairos_next with ${prevStepUri} and solution matching that step's challenge.`;
    } else if (proofType === 'user_input') {
      const prompt = prevProof.user_input?.prompt || 'Confirm (see step content).';
      message += ` For user_input you must obtain the user's actual reply — do not infer or invent. Submit that proof by calling kairos_next with ${prevStepUri} and solution.user_input.confirmation.`;
      next_action = `Ask the user: "${prompt}" then call kairos_next with ${prevStepUri} and solution.user_input.confirmation set to their reply.`;
    } else if (proofType === 'mcp') {
      const toolName = prevProof.mcp?.tool_name || 'the required tool';
      message += ` Submit that proof by calling kairos_next with ${prevStepUri} and solution.mcp. Call the MCP tool "${toolName}" and report its real result; do not fabricate.`;
      next_action = `Call ${toolName}, then call kairos_next with ${prevStepUri} and solution.mcp with the real result.`;
    } else if (proofType === 'comment') {
      const minLen = prevProof.comment?.min_length ?? 10;
      message += ` Submit that proof by calling kairos_next with ${prevStepUri} and solution.comment.text (min ${minLen} chars). Write a genuine summary of what was done; do not paste unrelated text.`;
      next_action = `call kairos_next with ${prevStepUri} and solution.comment.text (min ${minLen} chars).`;
    } else {
      message += ` Complete the required ${proofType} verification before continuing.`;
      next_action = `call kairos_next with ${prevStepUri} -- complete previous step first`;
    }
    if (!next_action) next_action = `call kairos_next with ${prevStepUri} -- complete previous step first`;
    const block: PreviousProofBlock = { message, error_code: 'MISSING_PROOF' };
    if (next_action !== undefined) block.next_action = next_action;
    return block;
  }
  if (storedResult.status !== 'success') {
    return { message: 'Previous step proof failed. Fix and retry.', error_code: 'COMMAND_FAILED' };
  }
  return null;
}
