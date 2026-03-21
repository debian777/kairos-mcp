import type { RewardRecord } from '../types/memory.js';

export type RewardGraderKind = 'human' | 'model' | 'unknown';
export type RewardEvaluationLabel = 'gold' | 'silver' | 'bronze' | 'rejected';

export interface RewardEvaluation {
  normalizedScore: number;
  signedScore: number;
  qualityBonus: number;
  label: RewardEvaluationLabel;
  graderKind: RewardGraderKind;
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

function hasStructuredEvalMetadata(params: { rater?: string; rubricVersion?: string }): boolean {
  return Boolean(params.rater?.trim() && params.rubricVersion?.trim());
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
  const hasEvalMetadata = hasStructuredEvalMetadata(params);

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
    exportableForSft: params.outcome === 'success' && hasEvalMetadata && normalizedScore >= MIN_SFT_SCORE,
    exportableForPreference: hasEvalMetadata && normalizedScore >= MIN_PREFERENCE_SCORE
  };
}

export function isRewardEligibleForSft(reward?: RewardRecord | null): boolean {
  return reward?.exportable_for_sft === true;
}

export function isRewardEligibleForPreference(reward?: RewardRecord | null): boolean {
  return reward?.exportable_for_preference === true;
}
