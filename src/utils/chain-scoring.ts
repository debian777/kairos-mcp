/**
 * Score a single step (label + text + tags) against a normalized query. Returns 0..1.
 * Used only for protocol-reconstruction optional scoring; main search uses Qdrant vector score.
 */
function scoreStepAgainstQuery(step: ChainScoringStep, normalizedQuery: string): number {
  const label = (step.label || '').toLowerCase();
  const text = (step.text || '').toLowerCase();
  const tags = (step.tags || []).map(t => t.toLowerCase());
  let score = 0;
  if (label.includes(normalizedQuery)) score += 300;
  if (text.includes(normalizedQuery)) score += 200;
  const tagMatches = tags.filter(t => t.includes(normalizedQuery) || normalizedQuery.includes(t));
  score += tagMatches.length * 150;
  const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 2);
  if (queryWords.length > 0) {
    const labelWords = label.split(/\s+/);
    const textWords = text.split(/\s+/);
    for (const qw of queryWords) {
      const inLabel = labelWords.some(w => w === qw || w.includes(qw) || qw.includes(w));
      const inText = textWords.some(w => w === qw || w.includes(qw) || qw.includes(w));
      if (inLabel) score += 50;
      if (inText) score += 30;
    }
    score = score / Math.sqrt(queryWords.length);
  }
  return Math.min(score / 500, 1.0);
}

export interface ChainScoringStep {
  label: string;
  text: string;
  tags: string[];
  created_at?: string;
  is_optional?: boolean;
  gem_potential?: number; // optional weighting factor per step
}

export interface ChainScoringWeights {
  mean?: number; // default 0.5
  max?: number; // default 0.3
  coverage?: number; // default 0.2
}

export interface ChainScoringResult {
  step_scores: number[]; // 0..1 per step
  coverage: number; // 0..1 of steps over threshold
  combined_score: number; // 0..1 aggregate
  max_score: number; // 0..1
  median_score: number; // 0..1
  anchor_index: number; // index of max scorer
  weights: Required<ChainScoringWeights>;
  threshold: number; // coverage threshold used
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const h = idx - lo;
  return sorted[lo]! * (1 - h) + sorted[hi]! * h;
}

export function scoreChainWithQuery(
  steps: ChainScoringStep[],
  query: string
): number[] {
  const normalized = (query || '').trim().toLowerCase();
  if (!normalized) return steps.map(() => 0);

  return steps.map((step) => scoreStepAgainstQuery(step, normalized));
}

export function aggregateChainScores(
  step_scores: number[],
  options?: {
    optional_mask?: boolean[]; // true if corresponding step is optional
    gem_weights?: number[]; // per-step multiplicative weights
    weights?: ChainScoringWeights; // mean/max/coverage weights
    threshold?: number; // coverage threshold, default 0.35
  }
): ChainScoringResult {
  const n = step_scores.length;
  if (n === 0) {
    return {
      step_scores: [],
      coverage: 0,
      combined_score: 0,
      max_score: 0,
      median_score: 0,
      anchor_index: -1,
      weights: { mean: 0.5, max: 0.3, coverage: 0.2 },
      threshold: options?.threshold ?? 0.35
    };
  }

  const threshold = options?.threshold ?? 0.35;
  const w = {
    mean: options?.weights?.mean ?? 0.5,
    max: options?.weights?.max ?? 0.3,
    coverage: options?.weights?.coverage ?? 0.2
  } as Required<ChainScoringWeights>;

  // Build effective per-step weights
  const optionalMask = options?.optional_mask || Array(n).fill(false);
  const gemWeights = options?.gem_weights || Array(n).fill(1);

  const baseWeights = step_scores.map((_, i) => (optionalMask[i] ? 0.5 : 1.0));
  const effectiveWeights = baseWeights.map((bw, i) => Math.max(0, bw * (gemWeights[i] ?? 1)));
  const totalWeight = effectiveWeights.reduce((a, b) => a + b, 0) || 1;

  // Weighted mean of step scores
  const weightedMean = step_scores.reduce((sum, s, i) => {
    const ew = effectiveWeights[i] ?? 0;
    return sum + s * ew;
  }, 0) / totalWeight;

  // Max and median
  let maxScore = -1;
  let anchorIndex = -1;
  step_scores.forEach((s, i) => {
    if (s > maxScore) {
      maxScore = s;
      anchorIndex = i;
    }
  });
  const median = percentile(step_scores, 0.5);

  // Coverage: fraction of steps over threshold
  const covered = step_scores.filter((s) => s >= threshold).length;
  const coverage = covered / n;

  // Combined score
  const combined = Math.max(0, Math.min(1, w.mean * weightedMean + w.max * maxScore + w.coverage * coverage));

  return {
    step_scores,
    coverage,
    combined_score: combined,
    max_score: maxScore,
    median_score: median,
    anchor_index: anchorIndex,
    weights: w,
    threshold
  };
}

export function scoreAndAggregateChain(
  steps: ChainScoringStep[],
  query: string,
  options?: Parameters<typeof aggregateChainScores>[1]
): ChainScoringResult {
  const perStep = scoreChainWithQuery(steps, query);
  return aggregateChainScores(perStep, options);
}
