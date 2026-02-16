import express from 'express';
import { MemoryQdrantStore } from '../services/memory/store.js';
import { structuredLogger } from '../utils/structured-logger.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { resolveChainNextStep, resolveChainPreviousStep } from '../services/chain-utils.js';
import { extractMemoryBody } from '../utils/memory-body.js';
import { proofOfWorkStore } from '../services/proof-of-work-store.js';
import { buildChallenge, handleProofSubmission, GENESIS_HASH } from '../tools/kairos_next-pow-helpers.js';

/**
 * Set up API route for kairos_next (V2: no next_step/protocol_status/attest_required/final_challenge,
 * proof_hash replaces last_proof_hash, two-phase retry escalation)
 */
export function setupNextRoute(app: express.Express, memoryStore: MemoryQdrantStore, qdrantService: QdrantService): void {
    app.post('/api/kairos_next', async (req, res) => {
        const startTime = Date.now();

        try {
            const { uri, solution } = req.body;

            if (!uri || typeof uri !== 'string') {
                res.status(400).json({
                    error: 'INVALID_INPUT',
                    message: 'uri is required and must be a string'
                });
                return;
            }

            structuredLogger.info(`-> POST /api/kairos_next (uri: ${uri})`);

            const normalizeMemoryUri = (value: string): { uuid: string; uri: string } => {
                const normalized = (value || '').trim();
                const uuid = normalized.split('/').pop()!;
                if (!uuid) {
                    throw new Error('Invalid kairos://mem URI');
                }
                const memUri = normalized.startsWith('kairos://mem/') ? normalized : `kairos://mem/${uuid}`;
                return { uuid, uri: memUri };
            };

            const { uuid, uri: requestedUri } = normalizeMemoryUri(uri);

            const memory = await memoryStore.getMemory(uuid);

            // Solution is required for steps 2+
            if (!solution) {
                const retryCount = await proofOfWorkStore.incrementRetry(uuid);
                const noSolChallenge = await buildChallenge(null, undefined);
                const duration = Date.now() - startTime;
                return res.status(200).json({
                    must_obey: retryCount < 3,
                    current_step: {
                        uri: requestedUri,
                        content: memory ? extractMemoryBody(memory.text) : '',
                        mimeType: 'text/markdown'
                    },
                    challenge: noSolChallenge,
                    message: 'Solution is required for steps 2+. Use kairos_begin for step 1.',
                    next_action: `retry kairos_next with ${requestedUri} -- include solution matching challenge`,
                    error_code: 'MISSING_FIELD',
                    retry_count: retryCount,
                    metadata: { duration_ms: duration }
                });
            }

            let submissionOutcome: { blockedPayload?: any; proofHash?: string } | undefined;
            if (memory?.proof_of_work) {
                const isStep1 = !memory.chain || memory.chain.step_index <= 1;
                let expectedPreviousHash: string;
                if (isStep1) {
                    expectedPreviousHash = GENESIS_HASH;
                } else {
                    const prev = await resolveChainPreviousStep(memory, qdrantService);
                    const prevHash = prev?.uuid ? await proofOfWorkStore.getProofHash(prev.uuid) : null;
                    expectedPreviousHash = prevHash ?? GENESIS_HASH;
                }
                submissionOutcome = await handleProofSubmission(solution, memory, { expectedPreviousHash });
                if (submissionOutcome.blockedPayload) {
                    const duration = Date.now() - startTime;
                    return res.status(200).json({
                        ...submissionOutcome.blockedPayload,
                        metadata: { duration_ms: duration }
                    });
                }
            }

            if (!memory) {
                const attestUri = requestedUri;
                const duration = Date.now() - startTime;
                return res.status(200).json({
                    must_obey: true,
                    current_step: {
                        uri: requestedUri,
                        content: '',
                        mimeType: 'text/markdown'
                    },
                    challenge: await buildChallenge(null, undefined),
                    message: 'Protocol completed. Call kairos_attest to finalize.',
                    next_action: `call kairos_attest with ${attestUri}, outcome, and message`,
                    metadata: { duration_ms: duration }
                });
            }

            // Resolve next step for display
            const nextStepInfo = await resolveChainNextStep(memory, qdrantService);
            const nextMemory = nextStepInfo
                ? await memoryStore.getMemory(nextStepInfo.uuid)
                : null;
            const displayMemory = nextMemory ?? memory;
            const challengeProof = nextMemory?.proof_of_work ?? memory?.proof_of_work;
            const displayUri = nextStepInfo ? `kairos://mem/${nextStepInfo.uuid}` : requestedUri;

            // Resolve the step AFTER display to get next_action URI
            const nextFromDisplay = displayMemory ? await resolveChainNextStep(displayMemory, qdrantService) : undefined;
            const nextStepUri = nextFromDisplay?.uuid
                ? `kairos://mem/${nextFromDisplay.uuid}`
                : null;

            const current_step = {
                uri: displayUri,
                content: displayMemory ? extractMemoryBody(displayMemory.text) : '',
                mimeType: 'text/markdown' as const
            };

            const challenge = await buildChallenge(displayMemory, challengeProof);

            const output: any = {
                must_obey: true,
                current_step,
                challenge
            };

            if (nextStepUri) {
                output.next_action = `call kairos_next with ${nextStepUri} and solution matching challenge`;
            } else {
                const attestUri = displayMemory ? `kairos://mem/${displayMemory.memory_uuid}` : requestedUri;
                output.message = 'Protocol completed. Call kairos_attest to finalize.';
                output.next_action = `call kairos_attest with ${attestUri}, outcome, and message`;
            }

            if (submissionOutcome?.proofHash) {
                output.proof_hash = submissionOutcome.proofHash;
            }

            const duration = Date.now() - startTime;
            structuredLogger.info(`kairos_next completed in ${duration}ms`);

            res.status(200).json({
                ...output,
                metadata: { duration_ms: duration }
            });
            return;

        } catch (error) {
            const duration = Date.now() - startTime;
            structuredLogger.error(`kairos_next failed in ${duration}ms`, error);
            res.status(500).json({
                error: 'NEXT_FAILED',
                message: error instanceof Error ? error.message : 'Failed to get next step',
                duration_ms: duration
            });
            return;
        }
    });
}
