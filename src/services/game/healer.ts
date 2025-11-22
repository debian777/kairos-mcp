/**
 * Healer bonus system: encapsulates logic to compute healer bonuses based on
 * qualityMetrics.healer_contributions structure.
 */

export function calculateHealerBonus(
    qualityMetrics: any,
    llm_model_id: string,
    improvementType: 'clarify' | 'correct' | 'enhance' | 'protocol_add'
): number {
    if (!qualityMetrics || !qualityMetrics.healer_contributions) return 0;
    const healerData = qualityMetrics.healer_contributions.healer_models[llm_model_id];
    if (!healerData) return 0;

    const baseBonuses: Record<string, number> = {
        clarify: 3,
        correct: 5,
        enhance: 4,
        protocol_add: 6
    };

    let bonus = baseBonuses[improvementType] || 3;
    const experienceMultiplier = Math.min(2, 1 + (healerData.improvements_made * 0.1));
    bonus *= experienceMultiplier;

    if (qualityMetrics.healer_contributions.total_healers === 1) bonus *= 1.5;
    return Math.min(15, Math.round(bonus));
}