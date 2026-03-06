/**
 * Build current_step and challenge for MISSING_PROOF response so the client gets the previous step's
 * challenge (correct nonce and proof_hash) for the next kairos_next call.
 */

import type { Memory } from '../types/memory.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { resolveChainPreviousStep } from '../services/chain-utils.js';
import { proofOfWorkStore } from '../services/proof-of-work-store.js';
import { buildChallenge, GENESIS_HASH } from './kairos_next-pow-helpers.js';
import { extractMemoryBody } from '../utils/memory-body.js';
import type { PreviousProofBlock } from './kairos_next-previous-step.js';

function buildCurrentStep(memory: Memory | null, requestedUri: string) {
  const uri = memory ? `kairos://mem/${memory.memory_uuid}` : requestedUri;
  const content = memory ? extractMemoryBody(memory.text) : '';
  return { uri, content, mimeType: 'text/markdown' as const };
}

export type MissingProofPayload = {
  current_step: ReturnType<typeof buildCurrentStep>;
  challenge: Awaited<ReturnType<typeof buildChallenge>> & { proof_hash: string };
  next_action: string;
  retry_count: number;
};

export async function buildMissingProofPayload(
  memory: Memory,
  previousBlock: PreviousProofBlock,
  requestedUri: string,
  uuid: string,
  loadMemory: (id: string) => Promise<Memory | null>,
  qdrantService: QdrantService | undefined
): Promise<MissingProofPayload> {
  const prev = await resolveChainPreviousStep(memory, qdrantService);
  const prevMemory = prev?.uuid ? await loadMemory(prev.uuid) : null;
  const prevUri = prev?.uuid ? `kairos://mem/${prev.uuid}` : requestedUri;
  const isPrevStep1 = !prevMemory?.chain || prevMemory.chain.step_index <= 1;
  const pPrev = prevMemory && !isPrevStep1 ? await resolveChainPreviousStep(prevMemory, qdrantService) : null;
  const expectedPrevHash = isPrevStep1 ? GENESIS_HASH : (pPrev?.uuid ? await proofOfWorkStore.getProofHash(pPrev.uuid) : null) ?? GENESIS_HASH;
  let challenge = await buildChallenge(prevMemory, prevMemory?.proof_of_work);
  challenge = { ...challenge, proof_hash: expectedPrevHash };
  const storedNonce = await proofOfWorkStore.getNonce(memory.memory_uuid);
  const retryCount = await proofOfWorkStore.incrementRetry(storedNonce ?? uuid);
  return {
    current_step: buildCurrentStep(prevMemory, prevUri),
    challenge,
    next_action: previousBlock.next_action ?? `retry kairos_next with ${prevUri} -- complete previous step first`,
    retry_count: retryCount
  };
}
