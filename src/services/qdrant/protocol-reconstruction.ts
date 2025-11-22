/**
 * Protocol Reconstruction Engine for KAIROS
 * 
 * Handles UUID-based step linking and dynamic protocol reconstruction
 * to enable flexible protocol workflows without strict protocol_id dependency
 */

import { v4 as uuidv4 } from 'uuid';
import { QdrantService } from './service.js';
import { MixedTypeProtocolStep } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

export interface ProtocolChain {
    protocol_title?: string;
    steps: MixedTypeProtocolStep[];
    total_steps: number;
    step_count_by_type: Record<string, number>;
    estimated_total_duration?: string;
    scoring?: {
        step_scores: number[];
        combined_score: number;
        coverage: number;
        max_score: number;
        median_score: number;
        anchor_index: number;
        weights: { mean: number; max: number; coverage: number };
        threshold: number;
    };
}

export interface ProtocolReconstructionOptions {
    include_metadata?: boolean;
    validate_chain?: boolean;
    max_depth?: number;
    follow_optional_steps?: boolean;
    // Optional scoring
    scoring?: {
        query: string;
        threshold?: number;
        weights?: { mean?: number; max?: number; coverage?: number };
    };
}

export class ProtocolReconstructionEngine {
    private qdrantService: QdrantService;
    private protocolCache = new Map<string, ProtocolChain>(); // Cache reconstructed protocols

    constructor(qdrantService: QdrantService) {
        this.qdrantService = qdrantService;
    }

    /**
     * Generate UUID for a protocol memory
     */
    generateMemoryUUID(): string {
        return uuidv4();
    }

    // Legacy UUID linking removed; chains reconstructed by memory_chain_id.

    /**
     * Reconstruct protocol from any starting step using UUID links
     */
    async reconstructProtocol(
        startStepUUID: string,
        options: ProtocolReconstructionOptions = {}
    ): Promise<ProtocolChain | null> {
        // Options are accepted for future use; current reconstruction uses chain IDs only.

        // Check cache first
        const cacheKey = `protocol:${startStepUUID}:${JSON.stringify(options)}`;
        if (this.protocolCache.has(cacheKey)) {
            logger.debug(`protocol-reconstruction: Cache hit for protocol starting at ${startStepUUID}`);
            return this.protocolCache.get(cacheKey)!;
        }

        logger.info(`protocol-reconstruction: Reconstructing protocol from step ${startStepUUID}`);

        // Get starting memory
        const startStep = await this.qdrantService.getMemoryByUUID(startStepUUID);
        if (!startStep) {
            logger.warn(`protocol-reconstruction: Starting memory ${startStepUUID} not found`);
            return null;
        }

        // New path: reconstruct by memory.chain.id when available
        if (startStep.chain) {
            const chainId = startStep.chain.id;
            logger.info(`protocol-reconstruction: Reconstructing by chain.id=${chainId}`);
            const chainPoints = await this.qdrantService.getChainMemories(chainId);
            if (!chainPoints.length) {
                logger.warn(`protocol-reconstruction: No points found for chain ${chainId}`);
                return null;
            }

            const steps = chainPoints.map((pt, idx) => {
                const p = pt.payload || {};
                const stepIndex = (p.chain && typeof p.chain.step_index === 'number') ? p.chain.step_index : (idx + 1);
                return {
                    memory_uuid: pt.uuid,
                    step_number: stepIndex,
                    step_type: (p.type as any) || 'context',
                    description_short: typeof p.label === 'string' ? p.label : (p.description_short || ''),
                    description_full: typeof p.text === 'string' ? p.text : (p.description_full || ''),
                    content_format: 'markdown',
                    tags: Array.isArray(p.tags) ? p.tags : [],
                    is_optional: false
                } as any;
            });

            // Link prev/next virtually (no writes)
            // Virtual linking removed; consumers should use chain ordering

            const stepCountByType: Record<string, number> = {};
            steps.forEach(s => { stepCountByType[s.step_type] = (stepCountByType[s.step_type] || 0) + 1; });

            const protocolChain: ProtocolChain = {
                protocol_title: startStep.task || 'chain',
                steps,
                total_steps: steps.length,
                step_count_by_type: stepCountByType
            };

            // Optional scoring
            if (options?.scoring?.query) {
                try {
                    const { scoreAndAggregateChain } = await import('../../utils/chain-scoring.js');
                    const stepsForScoring = steps.map(step => ({
                        label: step.description_short || `Step ${step.step_number}`,
                        text: step.description_full || '',
                        tags: Array.isArray(step.tags) ? step.tags : [],
                        is_optional: !!step.is_optional,
                    }));
                    const optionalMask = stepsForScoring.map(s => !!s.is_optional);
                    const scoring = scoreAndAggregateChain(
                        stepsForScoring,
                        options.scoring.query,
                        {
                            optional_mask: optionalMask,
                            ...(options.scoring.weights ? { weights: options.scoring.weights } : {}),
                            ...(options.scoring.threshold !== undefined ? { threshold: options.scoring.threshold } : {})
                        }
                    );
                    protocolChain.scoring = scoring;
                } catch (err) {
                    logger.warn(`protocol-reconstruction: scoring failed: ${err instanceof Error ? err.message : String(err)}`);
                }
            }

            return protocolChain;
        }

        return null;
    }

    /**
     * Validate protocol chain integrity
     */
    private validateProtocolChain(): { isValid: boolean; errors: string[] } {
        // With chain-based reconstruction, ordering comes from chain_step_index; no prev/next validation needed.
        return { isValid: true, errors: [] };
    }

    /**
     * Update UUID links when steps are modified, inserted, or deleted
     */
    async updateStepLinks(
        modifiedSteps: MixedTypeProtocolStep[]
    ): Promise<void> {
        logger.info(`protocol-reconstruction: Updating UUID links for modified sequence with ${modifiedSteps.length} steps`);

        // Chain-based model: no link regeneration; use provided steps as-is
        const updatedChain = modifiedSteps;

        // Update each memory in Qdrant with new UUID links
        for (let i = 0; i < updatedChain.length; i++) {
            const memory = updatedChain[i];

            if (!memory || !memory.memory_uuid) continue;

            // Find the corresponding Qdrant record
            const existingMemory = await this.qdrantService.getMemoryByUUID(memory.memory_uuid);
            if (existingMemory) {
                // Update the Qdrant record with new UUID links
                await this.qdrantService.updateMemoryByUUID(memory.memory_uuid, {
                    ...existingMemory,
                    protocol: {
                        ...existingMemory.protocol,
                        memory_uuid: memory.memory_uuid
                    }
                });

                logger.debug(`protocol-reconstruction: Updated UUID links for memory ${i + 1} (${memory.memory_uuid})`);
            }
        }

        // Clear all reconstruction cache entries since chains changed
        this.clearCache();
        logger.info(`protocol-reconstruction: Successfully updated UUID links for modified sequence`);
    }

    /**
     * Clear all protocol cache entries
     */
    private clearCache(): void {
        const count = this.protocolCache.size;
        this.protocolCache.clear();
        logger.debug(`protocol-reconstruction: Cleared ${count} cache entries`);
    }

    /**
     * Get protocol statistics
     */
    getProtocolStats(protocol: ProtocolChain): {
        total_steps: number;
        step_types: Record<string, number>;
        optional_steps: number;
        estimated_completion_time?: string | undefined;
    } {
        const optionalSteps = protocol.steps.filter(step => step.is_optional).length;

        return {
            total_steps: protocol.total_steps,
            step_types: protocol.step_count_by_type,
            optional_steps: optionalSteps,
            estimated_completion_time: protocol.estimated_total_duration
        };
    }

    /**
     * Find alternative paths in flexible protocols
     */
    findAlternativePaths(): MixedTypeProtocolStep[] {
        const alternatives: MixedTypeProtocolStep[] = [];

        // Implementation for finding alternative paths based on preferences
        // This would involve analyzing the protocol structure and identifying
        // branching points or optional steps that could provide alternative routes

        return alternatives;
    }
}

export default ProtocolReconstructionEngine;
