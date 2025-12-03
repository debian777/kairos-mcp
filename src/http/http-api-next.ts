import express from 'express';
import { MemoryQdrantStore } from '../services/memory/store.js';
import { structuredLogger } from '../utils/structured-logger.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { resolveChainNextStep } from '../services/chain-utils.js';
import { extractMemoryBody } from '../utils/memory-body.js';
import { proofOfWorkStore } from '../services/proof-of-work-store.js';

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
            const { uri, proof_of_work } = req.body;

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

            // Handle proof of work submission if provided
            if (proof_of_work) {
                // Get the previous step's memory to store the proof result
                const memory = await memoryStore.getMemory(uuid);
                if (memory?.proof_of_work) {
                    // Convert new proof_of_work format to proof store record
                    let record: any = {
                        result_id: `pow_${uuid}_${Date.now()}`,
                        executed_at: new Date().toISOString(),
                        type: proof_of_work.type || 'shell'
                    };

                    if (proof_of_work.type === 'shell' && proof_of_work.shell) {
                        record.status = (proof_of_work.shell.exit_code === 0 ? 'success' : 'failed') as 'success' | 'failed';
                        record.exit_code = proof_of_work.shell.exit_code;
                        record.duration_seconds = proof_of_work.shell.duration_seconds;
                        record.stdout = proof_of_work.shell.stdout;
                        record.stderr = proof_of_work.shell.stderr;
                        record.shell = proof_of_work.shell;
                    } else if (proof_of_work.type === 'mcp' && proof_of_work.mcp) {
                        record.status = proof_of_work.mcp.success ? 'success' : 'failed';
                        record.mcp = proof_of_work.mcp;
                    } else if (proof_of_work.type === 'user_input' && proof_of_work.user_input) {
                        record.status = 'success';
                        record.user_input = proof_of_work.user_input;
                    } else if (proof_of_work.type === 'comment' && proof_of_work.comment) {
                        record.status = 'success';
                        record.comment = proof_of_work.comment;
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
                    message: 'Protocol completed. Call kairos_attest to finalize with proof_of_work.'
                };
                const duration = Date.now() - startTime;
                return res.status(200).json({
                    ...output,
                    metadata: { duration_ms: duration }
                });
            }

            const nextStepInfo = await resolveChainNextStep(memory, qdrantService);
            const proofResult = await proofOfWorkStore.getResult(memory.memory_uuid);

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
                output.message = 'Protocol completed. Call kairos_attest to finalize with proof_of_work.';
            }

            if (memory.proof_of_work) {
                output.proof_of_work = {
                    cmd: memory.proof_of_work.cmd,
                    timeout_seconds: memory.proof_of_work.timeout_seconds
                };
            }

            if (proofResult) {
                output.proof_of_work_result = {
                    status: proofResult.status,
                    exit_code: proofResult.exit_code,
                    ...(proofResult.result_id && { result_id: proofResult.result_id }),
                    ...(proofResult.executed_at && { executed_at: proofResult.executed_at }),
                    ...(typeof proofResult.duration_seconds === 'number' && { duration_seconds: proofResult.duration_seconds }),
                    ...(proofResult.stdout && { stdout: proofResult.stdout }),
                    ...(proofResult.stderr && { stderr: proofResult.stderr })
                };
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

