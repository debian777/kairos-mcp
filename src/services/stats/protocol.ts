/**
 * Protocol-level gem metadata calculations.
 *
 * Responsible for computing workflow-level potential/quality by aggregating
 * step gem metadata retrieved from Qdrant.
 */

import { logger } from '../../utils/logger.js';

export async function calculateProtocolGemMetadata(protocolId: string): Promise<{
    workflow_total_potential: number;
    workflow_quality: string;
}> {
    try {
        // Import qdrantService singleton lazily to avoid circular deps
        const { qdrantService } = await import('../qdrant/index.js');

        const protocolSteps = await qdrantService.findProtocolSteps(protocolId);
        if (!Array.isArray(protocolSteps) || protocolSteps.length === 0) {
            return {
                workflow_total_potential: 1,
                workflow_quality: 'Single Step Protocol'
            };
        }

        let totalPotential = 0;
        const stepQualities: string[] = [];

        for (const step of protocolSteps) {
            const stepQuality = step.payload?.quality_metadata || step.payload?.gem_metadata;
            if (stepQuality) {
                totalPotential += stepQuality.step_quality_score || stepQuality.step_gem_potential || 1;
                stepQualities.push(stepQuality.step_quality || 'standard');
            } else {
                totalPotential += 1;
                stepQualities.push('quality');
            }
        }

        const maxPotential = Math.max(...protocolSteps.map(s => (s.payload?.quality_metadata?.step_quality_score || s.payload?.gem_metadata?.step_gem_potential || 1)));

        let workflowQuality: string;
        if (maxPotential >= 5 && totalPotential >= 15) workflowQuality = 'Legendary Workflow';
        else if (maxPotential >= 3 && totalPotential >= 8) workflowQuality = 'Rare Workflow';
        else if (totalPotential >= 5) workflowQuality = 'Quality Workflow';
        else workflowQuality = 'Standard Protocol';

        return {
            workflow_total_potential: totalPotential,
            workflow_quality: workflowQuality
        };
    } catch (error) {
        logger.warn(`Failed to calculate protocol quality metadata for ${protocolId}: ${error instanceof Error ? error.message : String(error)}`);
        return {
            workflow_total_potential: 3,
            workflow_quality: 'Standard Protocol'
        };
    }
}