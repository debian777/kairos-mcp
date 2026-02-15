import express from 'express';
import { MemoryQdrantStore } from '../services/memory/store.js';
import { structuredLogger } from '../utils/structured-logger.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { resolveChainNextStep } from '../services/chain-utils.js';
import { extractMemoryBody } from '../utils/memory-body.js';
import { redisCacheService } from '../services/redis-cache.js';
import type { Memory } from '../types/memory.js';
import { buildChallenge } from '../tools/kairos_next-pow-helpers.js';

/**
 * Set up API route for kairos_begin (step 1, no proof-of-work required)
 * @param app Express application instance
 * @param memoryStore Memory store instance
 * @param qdrantService Qdrant service instance
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

            structuredLogger.info(`→ POST /api/kairos_begin (uri: ${uri})`);

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

            // Validate that this is step 1
            if (memory?.chain) {
                if (memory.chain.step_index !== 1) {
                    const duration = Date.now() - startTime;
                    return res.status(400).json({
                        error: 'INVALID_STEP',
                        message: `This is step ${memory.chain.step_index}, not step 1. Use kairos_next for steps 2+.`,
                        metadata: { duration_ms: duration }
                    });
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

            // When protocol is completed, indicate that kairos_attest should be called
            if (protocol_status === 'completed') {
                output.attest_required = true;
                output.message = 'Protocol completed. Call kairos_attest to finalize with final_solution.';
            }

            const duration = Date.now() - startTime;
            structuredLogger.info(`✓ kairos_begin completed in ${duration}ms`);

            res.status(200).json({
                ...output,
                metadata: { duration_ms: duration }
            });
            return;

        } catch (error) {
            const duration = Date.now() - startTime;
            structuredLogger.error(`✗ kairos_begin failed in ${duration}ms`, error);
            res.status(500).json({
                error: 'BEGIN_FAILED',
                message: error instanceof Error ? error.message : 'Failed to get step 1',
                duration_ms: duration
            });
            return;
        }
    });
}

