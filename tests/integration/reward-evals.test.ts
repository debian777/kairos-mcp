import { evaluateReward, isRewardEligibleForPreference, isRewardEligibleForSft } from '../../src/services/reward-evals.js';

describe('reward eval normalization', () => {
  test('success rewards default to the strongest normalized score but stay gated without rubric metadata', () => {
    const evaluation = evaluateReward({ outcome: 'success' });

    expect(evaluation.normalizedScore).toBe(1);
    expect(evaluation.signedScore).toBe(1);
    expect(evaluation.qualityBonus).toBe(1);
    expect(evaluation.label).toBe('gold');
    expect(evaluation.exportableForSft).toBe(false);
    expect(evaluation.exportableForPreference).toBe(false);
  });

  test('failure rewards become negative quality bonuses and can seed preference exports with structured eval metadata', () => {
    const evaluation = evaluateReward({
      outcome: 'failure',
      score: 0.9,
      rater: 'grader@example.com',
      rubricVersion: 'reward-v1'
    });

    expect(evaluation.normalizedScore).toBeCloseTo(0.9);
    expect(evaluation.signedScore).toBeCloseTo(-0.9);
    expect(evaluation.qualityBonus).toBeCloseTo(-0.9);
    expect(evaluation.label).toBe('rejected');
    expect(evaluation.exportableForSft).toBe(false);
    expect(evaluation.exportableForPreference).toBe(true);
  });

  test('model-graded rewards become exportable when rubric metadata is present', () => {
    const evaluation = evaluateReward({
      outcome: 'success',
      score: 0.82,
      rubricVersion: 'reward-v1',
      llmModelId: 'grader-model-v1'
    });

    expect(evaluation.graderKind).toBe('model');
    expect(evaluation.exportableForSft).toBe(true);
    expect(evaluation.exportableForPreference).toBe(true);
    expect(evaluation.sftEligibility.blockers).toEqual([]);
    expect(evaluation.preferenceEligibility.blockers).toEqual([]);
  });

  test('eligibility helpers only allow explicitly graded rewards into exports', () => {
    expect(
      isRewardEligibleForSft({
        outcome: 'success',
        score: 0.8,
        exportable_for_sft: true,
        rated_at: new Date().toISOString()
      })
    ).toBe(true);

    expect(
      isRewardEligibleForPreference({
        outcome: 'failure',
        score: 0.85,
        exportable_for_preference: true,
        rated_at: new Date().toISOString()
      })
    ).toBe(true);

    expect(
      isRewardEligibleForSft({
        outcome: 'success',
        score: 0.8,
        rubric_version: 'reward-v1',
        llm_model_id: 'grader-model-v1',
        rated_at: new Date().toISOString()
      })
    ).toBe(true);

    expect(isRewardEligibleForSft(undefined)).toBe(false);
    expect(isRewardEligibleForPreference(undefined)).toBe(false);
  });
});
