/**
 * Implementation bonus core algorithms (statistical adjustments, rarity/comparative)
 * These functions are pure/near-pure and operate on supplied data structures so the
 * orchestrator can handle persistence and state mutation.
 */

import type { ModelImplementationData } from '../../types/index.js';

export function calculateWilsonAdjustment(modelData: ModelImplementationData): number {
    const { successes, attempts } = modelData;
    if (attempts === 0) return 0.5;
    const z = 1.96;
    const p = successes / attempts;
    const n = attempts;
    const denominator = 1 + z * z / n;
    const numerator = p + z * z / (2 * n);
    const adjustment = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
    const lowerBound = Math.max(0, (numerator - adjustment) / denominator);
    return 0.5 + (lowerBound * 1.0);
}

/**
 * Compute implementation bonus given a qualityMetrics object.
 *
 * This function mutates qualityMetrics to record attempts/successes for the specific model.
 * It returns an object describing the awarded bonus and whether a "rare success" occurred.
 *
 * Parameters:
 * - qualityMetrics: the QualityMetrics object from memory payload (may be created by caller)
 * - llm_model_id: model identifier
 * - outcome: 'success' | 'partial' | 'failure'
 *
 * Returns:
 * { finalBonus, comparativeBonus, rarityMultiplier, rareSuccess }
 */
export function computeImplementationBonus(
    qualityMetrics: any,
    llm_model_id: string,
    outcome: 'success' | 'partial' | 'failure'
): {
    finalBonus: number;
    comparativeBonus: number;
    rarityMultiplier: number;
    rareSuccess: boolean;
} {
    if (!qualityMetrics.implementation_stats) {
        qualityMetrics.implementation_stats = {
            total_attempts: 0,
            success_attempts: 0,
            model_success_rates: {},
            confidence_level: 0,
            last_implementation_attempt: null
        };
    }
    const stats = qualityMetrics.implementation_stats;

    if (!stats.model_success_rates[llm_model_id]) {
        stats.model_success_rates[llm_model_id] = {
            attempts: 0,
            successes: 0,
            success_rate: 0,
            wilson_lower: 0,
            wilson_upper: 0,
            last_attempt: null
        };
    }

    const modelData: ModelImplementationData = stats.model_success_rates[llm_model_id];

    // Update attempts
    stats.total_attempts = (stats.total_attempts || 0) + 1;
    modelData.attempts = (modelData.attempts || 0) + 1;

    // Determine base bonus
    let bonus = 0;
    if (outcome === 'success') {
        bonus = 5;
        stats.success_attempts = (stats.success_attempts || 0) + 1;
        modelData.successes = (modelData.successes || 0) + 1;
    } else if (outcome === 'partial') {
        bonus = 2;
    } else {
        // failure: record and return 0
        modelData.success_rate = modelData.attempts > 0 ? (modelData.successes || 0) / modelData.attempts : 0;
        return { finalBonus: 0, comparativeBonus: 0, rarityMultiplier: 1, rareSuccess: false };
    }

    modelData.success_rate = modelData.attempts > 0 ? (modelData.successes || 0) / modelData.attempts : 0;

    const overallSuccessRate = stats.total_attempts > 0 ? (stats.success_attempts || 0) / stats.total_attempts : 0;
    const rarityMultiplier = Math.max(1, 1 / Math.max(0.1, overallSuccessRate));

    // Comparative bonus when model outperforms others
    let comparativeBonus = 0;
    const otherModels = Object.entries(stats.model_success_rates).filter(([modelId]) => modelId !== llm_model_id);
    if (otherModels.length > 0) {
        const otherSuccessRates = otherModels.map(([, data]: any) =>
            data.attempts > 0 ? (data.successes || 0) / data.attempts : 0
        );
        const avgOtherSuccessRate = otherSuccessRates.reduce((s, r) => s + r, 0) / otherSuccessRates.length;
        if (avgOtherSuccessRate < 0.5 && modelData.success_rate > avgOtherSuccessRate) {
            comparativeBonus = Math.min(10, (modelData.success_rate - avgOtherSuccessRate) * 20);
            bonus += comparativeBonus;
        }
    }

    // Wilson adjustment
    const wilsonAdj = calculateWilsonAdjustment(modelData);
    bonus *= wilsonAdj;

    // Apply rarity multiplier (capped at 3x)
    bonus *= Math.min(3, rarityMultiplier);

    const finalBonus = Math.min(25, Math.round(bonus));

    const rareSuccess = comparativeBonus > 0 && outcome === 'success';

    return { finalBonus, comparativeBonus, rarityMultiplier, rareSuccess };
}