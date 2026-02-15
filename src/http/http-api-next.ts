import express from 'express';
import { MemoryQdrantStore } from '../services/memory/store.js';
import { structuredLogger } from '../utils/structured-logger.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { resolveChainNextStep, resolveChainPreviousStep } from '../services/chain-utils.js';
import { extractMemoryBody } from '../utils/memory-body.js';
import { proofOfWorkStore } from '../services/proof-of-work-store.js';
import { buildChallenge, handleProofSubmission, GENESIS_HASH } from '../tools/kairos_next-pow-helpers.js';

/**
 * Set up API route for kairos_next
 * @param app Express application instance
 * @param memoryStore Memory store instance
 * @param qdrantService Qdrant service instance
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

            structuredLogger.info(`→ POST /api/kairos_next (uri: ${uri})`);

            const normalizeMemoryUri = (value: string): { uuid: string; uri: string } => {
                const normalized = (value || '').trim();
                const uuid = normalized.split('/').pop()!;
                if (!uuid) {
                    throw new Error('Invalid kairos://mem URI');
                }
                const uri = normalized.startsWith('kairos://mem/') ? normalized : `kairos://mem/${uuid}`;
                return { uuid, uri };
            };

            const { uuid, uri: requestedUri } = normalizeMemoryUri(uri);

            // Validate solution is required for steps 2+
            // First check if this is step 1 (which should use kairos_begin, not kairos_next)
            const memory = await memoryStore.getMemory(uuid);
            if (memory?.chain && memory.chain.step_index === 1) {
                res.status(400).json({
                    error: 'INVALID_INPUT',
                    message: 'This is step 1. Use kairos_begin for step 1, not kairos_next.'
                });
                return;
            }

            // Solution is required for steps 2+
            if (!solution) {
                res.status(400).json({
                    error: 'INVALID_INPUT',
                    message: 'solution is required for steps 2+. Use kairos_begin for step 1.'
                });
                return;
            }

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
                const submissionOutcome = await handleProofSubmission(solution, memory, { expectedPreviousHash });
                if (submissionOutcome.blockedPayload) {
                    const challenge = await buildChallenge(memory, memory.proof_of_work);
                    const duration = Date.now() - startTime;
                    return res.status(200).json({
                        ...submissionOutcome.blockedPayload,
                        current_step: {
                            uri: `kairos://mem/${memory.memory_uuid}`,
                            content: extractMemoryBody(memory.text),
                            mimeType: 'text/markdown' as const
                        },
                        challenge,
                        metadata: { duration_ms: duration }
                    });
                }
            }

            if (!memory) {
                const current_step = {
                    uri: requestedUri,
                    content: '',
                    mimeType: 'text/markdown' as const
                };
                const output: any = {
                    must_obey: true,
                    current_step,
                    next_step: null,
                    protocol_status: 'completed' as const,
                    attest_required: true,
                    message: 'Protocol completed. Call kairos_attest to finalize with final_solution.',
                    next_action: 'call kairos_attest with final_solution'
                };
                const duration = Date.now() - startTime;
                return res.status(200).json({
                    ...output,
                    metadata: { duration_ms: duration }
                });
            }

            const nextStepInfo = await resolveChainNextStep(memory, qdrantService);

            const current_step = {
                uri: `kairos://mem/${memory.memory_uuid}`,
                content: extractMemoryBody(memory.text),
                mimeType: 'text/markdown' as const
            };

            const next_step = nextStepInfo ? {
                uri: `kairos://mem/${nextStepInfo.uuid}`,
                position: `${nextStepInfo.step || 1}/${nextStepInfo.count || 1}`,
                label: nextStepInfo.label || 'Next step'
            } : null;

            const protocol_status = next_step ? 'continue' : 'completed';

            const challenge = await buildChallenge(memory, memory?.proof_of_work);
            const output: any = {
                must_obey: true,
                current_step,
                protocol_status,
                challenge
            };

            if (protocol_status === 'completed') {
                output.attest_required = true;
                output.message = 'Protocol completed. Call kairos_attest to finalize with final_solution.';
                output.final_challenge = await buildChallenge(memory, memory?.proof_of_work);
                output.next_action = 'call kairos_attest with final_solution';
            } else {
                output.next_action = 'call kairos_next with next step uri and solution matching challenge';
            }

            const duration = Date.now() - startTime;
            structuredLogger.info(`✓ kairos_next completed in ${duration}ms`);

            res.status(200).json({
                ...output,
                metadata: { duration_ms: duration }
            });
            return;

        } catch (error) {
            const duration = Date.now() - startTime;
            structuredLogger.error(`✗ kairos_next failed in ${duration}ms`, error);
            res.status(500).json({
                error: 'NEXT_FAILED',
                message: error instanceof Error ? error.message : 'Failed to get next step',
                duration_ms: duration
            });
            return;
        }
    });
}

