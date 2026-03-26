import type { RewardRecord } from '../types/memory.js';

export type RewardGraderKind = 'human' | 'model' | 'unknown';
export type RewardEvaluationLabel = 'gold' | 'silver' | 'bronze' | 'rejected';
export type RewardEligibilityBlocker =
  | 'missing_rubric_version'
  | 'missing_evaluator_identity'
  | 'outcome_not_success'
  | 'score_below_sft_threshold'
  | 'score_below_preference_threshold';

export interface RewardEligibility {
  eligible: boolean;
  blockers: RewardEligibilityBlocker[];
}

export interface RewardEvaluation {
  normalizedScore: number;
  signedScore: number;
  qualityBonus: number;
  label: RewardEvaluationLabel;
  graderKind: RewardGraderKind;
  sftEligibility: RewardEligibility;
  preferenceEligibility: RewardEligibility;
  exportableForSft: boolean;
  exportableForPreference: boolean;
}

const DEFAULT_SUCCESS_SCORE = 1;
const DEFAULT_FAILURE_SCORE = 0;
const MIN_SFT_SCORE = 0.65;
const MIN_PREFERENCE_SCORE = 0.7;

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function inferGraderKind(params: { rater?: string; llmModelId?: string }): RewardGraderKind {
  if (params.llmModelId) {
    return 'model';
  }
  if (params.rater) {
    return 'human';
  }
  return 'unknown';
}

function hasEvaluatorIdentity(params: { rater?: string; llmModelId?: string }): boolean {
  return Boolean(params.rater?.trim() || params.llmModelId?.trim());
}

function buildEligibility(params: {
  outcome: 'success' | 'failure';
  normalizedScore: number;
  rater?: string;
  rubricVersion?: string;
  llmModelId?: string;
}): { sftEligibility: RewardEligibility; preferenceEligibility: RewardEligibility } {
  const sharedBlockers: RewardEligibilityBlocker[] = [];
  if (!params.rubricVersion?.trim()) {
    sharedBlockers.push('missing_rubric_version');
  }
  if (!hasEvaluatorIdentity(params)) {
    sharedBlockers.push('missing_evaluator_identity');
  }

  const sftBlockers: RewardEligibilityBlocker[] = [...sharedBlockers];
  if (params.outcome !== 'success') {
    sftBlockers.push('outcome_not_success');
  }
  if (params.normalizedScore < MIN_SFT_SCORE) {
    sftBlockers.push('score_below_sft_threshold');
  }

  const preferenceBlockers: RewardEligibilityBlocker[] = [...sharedBlockers];
  if (params.normalizedScore < MIN_PREFERENCE_SCORE) {
    preferenceBlockers.push('score_below_preference_threshold');
  }

  return {
    sftEligibility: {
      eligible: sftBlockers.length === 0,
      blockers: sftBlockers
    },
    preferenceEligibility: {
      eligible: preferenceBlockers.length === 0,
      blockers: preferenceBlockers
    }
  };
}

function evaluateRewardRecord(reward: RewardRecord): RewardEvaluation {
  return evaluateReward({
    outcome: reward.outcome,
    ...(reward.score !== undefined ? { score: reward.score } : {}),
    ...(reward.rater !== undefined ? { rater: reward.rater } : {}),
    ...(reward.rubric_version !== undefined ? { rubricVersion: reward.rubric_version } : {}),
    ...(reward.llm_model_id !== undefined ? { llmModelId: reward.llm_model_id } : {})
  });
}

export function evaluateReward(params: {
  outcome: 'success' | 'failure';
  score?: number;
  rater?: string;
  rubricVersion?: string;
  llmModelId?: string;
}): RewardEvaluation {
  const normalizedScore = clampScore(
    params.score ?? (params.outcome === 'success' ? DEFAULT_SUCCESS_SCORE : DEFAULT_FAILURE_SCORE)
  );
  const signedScore = params.outcome === 'success' ? normalizedScore : -normalizedScore;
  const qualityBonus = signedScore;
  const { sftEligibility, preferenceEligibility } = buildEligibility({
    outcome: params.outcome,
    normalizedScore,
    ...(params.rater !== undefined ? { rater: params.rater } : {}),
    ...(params.rubricVersion !== undefined ? { rubricVersion: params.rubricVersion } : {}),
    ...(params.llmModelId !== undefined ? { llmModelId: params.llmModelId } : {})
  });

  let label: RewardEvaluationLabel;
  if (params.outcome === 'failure') {
    label = 'rejected';
  } else if (normalizedScore >= 0.85) {
    label = 'gold';
  } else if (normalizedScore >= MIN_SFT_SCORE) {
    label = 'silver';
  } else {
    label = 'bronze';
  }

  return {
    normalizedScore,
    signedScore,
    qualityBonus,
    label,
    graderKind: inferGraderKind(params),
    sftEligibility,
    preferenceEligibility,
    exportableForSft: sftEligibility.eligible,
    exportableForPreference: preferenceEligibility.eligible
  };
}

export function isRewardEligibleForSft(reward?: RewardRecord | null): boolean {
  if (!reward) {
    return false;
  }
  if (reward.exportable_for_sft !== undefined) {
    return reward.exportable_for_sft === true;
  }
  return evaluateRewardRecord(reward).exportableForSft;
}

export function isRewardEligibleForPreference(reward?: RewardRecord | null): boolean {
  if (!reward) {
    return false;
  }
  if (reward.exportable_for_preference !== undefined) {
    return reward.exportable_for_preference === true;
  }
  return evaluateRewardRecord(reward).exportableForPreference;
}
