import express from 'express';
import { MemoryQdrantStore } from '../services/memory/store.js';
import { structuredLogger } from '../utils/structured-logger.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { resolveChainNextStep } from '../services/chain-utils.js';
import { extractMemoryBody } from '../utils/memory-body.js';
import { proofOfWorkStore } from '../services/proof-of-work-store.js';
import { buildChallenge } from '../tools/kairos_next-pow-helpers.js';

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

            // Handle solution submission if provided
            if (solution) {
                // Get the previous step's memory to store the solution result
                const memory = await memoryStore.getMemory(uuid);
                if (memory?.proof_of_work) {
                    // Convert new solution format to proof store record
                    let record: any = {
                        result_id: `pow_${uuid}_${Date.now()}`,
                        executed_at: new Date().toISOString(),
                        type: solution.type || 'shell'
                    };

                    if (solution.type === 'shell' && solution.shell) {
                        record.status = (solution.shell.exit_code === 0 ? 'success' : 'failed') as 'success' | 'failed';
                        record.exit_code = solution.shell.exit_code;
                        record.duration_seconds = solution.shell.duration_seconds;
                        record.stdout = solution.shell.stdout;
                        record.stderr = solution.shell.stderr;
                        record.shell = solution.shell;
                    } else if (solution.type === 'mcp' && solution.mcp) {
                        record.status = solution.mcp.success ? 'success' : 'failed';
                        record.mcp = solution.mcp;
                    } else if (solution.type === 'user_input' && solution.user_input) {
                        record.status = 'success';
                        record.user_input = solution.user_input;
                    } else if (solution.type === 'comment' && solution.comment) {
                        record.status = 'success';
                        record.comment = solution.comment;
                    } else {
                        // Fallback for backward compatibility
                        record.status = 'success';
                    }

                    await proofOfWorkStore.saveResult(uuid, record);
                }
            }

            const memory = await memoryStore.getMemory(uuid);

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
                    message: 'Protocol completed. Call kairos_attest to finalize with final_solution.'
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

            const output: any = {
                must_obey: true,
                current_step,
                next_step,
                protocol_status
            };

            // When protocol is completed, indicate that kairos_attest should be called
            if (protocol_status === 'completed') {
                output.attest_required = true;
                output.message = 'Protocol completed. Call kairos_attest to finalize with final_solution.';
                // Add final_challenge on last step
                if (memory.proof_of_work) {
                    output.final_challenge = buildChallenge(memory.proof_of_work);
                }
            }

            // Add challenge field
            if (memory.proof_of_work) {
                output.challenge = buildChallenge(memory.proof_of_work);
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

