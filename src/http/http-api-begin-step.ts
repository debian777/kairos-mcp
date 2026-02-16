import express from 'express';
import { MemoryQdrantStore } from '../services/memory/store.js';
import { structuredLogger } from '../utils/structured-logger.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { resolveChainNextStep, resolveChainFirstStep } from '../services/chain-utils.js';
import { extractMemoryBody } from '../utils/memory-body.js';
import { redisCacheService } from '../services/redis-cache.js';
import type { Memory } from '../types/memory.js';
import { buildChallenge } from '../tools/kairos_next-pow-helpers.js';

/**
 * Set up API route for kairos_begin (V2: auto-redirect, no next_step/protocol_status/attest_required)
 */
export function setupBeginStepRoute(app: express.Express, memoryStore: MemoryQdrantStore, qdrantService: QdrantService): void {
    app.post('/api/kairos_begin', async (req, res) => {
        const startTime = Date.now();

        try {
            const { uri } = req.body;

            if (!uri || typeof uri !== 'string') {
                res.status(400).json({
                    error: 'INVALID_INPUT',
                    message: 'uri is required and must be a string'
                });
                return;
            }

            structuredLogger.info(`-> POST /api/kairos_begin (uri: ${uri})`);

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

            // Load memory with cache
            let memory: Memory | null = null;
            const cached = await redisCacheService.getMemoryResource(uuid);
            if (cached) {
                memory = cached;
            } else {
                memory = await memoryStore.getMemory(uuid);
                if (memory) {
                    await redisCacheService.setMemoryResource(memory);
                }
            }

            let redirectMessage: string | undefined;

            // Auto-redirect: if not step 1, resolve and present step 1
            if (memory?.chain && memory.chain.step_index !== 1) {
                const firstStep = await resolveChainFirstStep(memory, qdrantService);
                if (firstStep?.uuid) {
                    const step1Cached = await redisCacheService.getMemoryResource(firstStep.uuid);
                    const step1Memory = step1Cached || await memoryStore.getMemory(firstStep.uuid);
                    if (step1Memory) {
                        if (!step1Cached) await redisCacheService.setMemoryResource(step1Memory);
                        memory = step1Memory;
                        redirectMessage = 'Redirected to step 1 of this protocol chain.';
                    }
                }
            }

            const nextStepInfo = memory
                ? await resolveChainNextStep(memory, qdrantService)
                : undefined;

            const current_step = {
                uri: memory ? `kairos://mem/${memory.memory_uuid}` : requestedUri,
                content: memory ? extractMemoryBody(memory.text) : '',
                mimeType: 'text/markdown' as const
            };

            const challenge = await buildChallenge(memory, memory?.proof_of_work);

            const output: any = {
                must_obey: true,
                current_step,
                challenge
            };

            if (redirectMessage) {
                output.message = redirectMessage;
            }

            const nextStepUri = nextStepInfo?.uuid
                ? `kairos://mem/${nextStepInfo.uuid}`
                : null;

            if (nextStepUri) {
                output.next_action = `call kairos_next with ${nextStepUri} and solution matching challenge`;
            } else {
                const attestUri = memory ? `kairos://mem/${memory.memory_uuid}` : requestedUri;
                output.message = 'Protocol completed. Call kairos_attest to finalize.';
                output.next_action = `call kairos_attest with ${attestUri}, outcome, and message`;
            }

            const duration = Date.now() - startTime;
            structuredLogger.info(`kairos_begin completed in ${duration}ms`);

            res.status(200).json({
                ...output,
                metadata: { duration_ms: duration }
            });
            return;

        } catch (error) {
            const duration = Date.now() - startTime;
            structuredLogger.error(`kairos_begin failed in ${duration}ms`, error);
            res.status(500).json({
                error: 'BEGIN_FAILED',
                message: error instanceof Error ? error.message : 'Failed to get step 1',
                duration_ms: duration
            });
            return;
        }
    });
}
