import type { Memory } from '../../types/memory.js';

function normalizeTerms(value: string): string[] {
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .split(/\s+/)
        .map((term) => term.trim())
        .filter((term) => term.length >= 2)
    )
  );
}

function scoreText(queryTerms: string[], normalizedQuery: string, candidate: string, weight: number): number {
  if (!candidate.trim()) {
    return 0;
  }

  const candidateTerms = normalizeTerms(candidate);
  if (candidateTerms.length === 0) {
    return 0;
  }

  const normalizedCandidate = candidateTerms.join(' ');
  const overlap = queryTerms.filter((term) => candidateTerms.includes(term)).length;
  const overlapScore = (overlap / queryTerms.length) * weight;

  if (normalizedCandidate === normalizedQuery) {
    return overlapScore + weight * 0.6;
  }
  if (normalizedCandidate.includes(normalizedQuery) || normalizedQuery.includes(normalizedCandidate)) {
    return overlapScore + weight * 0.35;
  }

  return overlapScore;
}

export function scoreActivationRerank(query: string, memory: Memory): number {
  const queryTerms = normalizeTerms(query);
  if (queryTerms.length === 0) {
    return 0;
  }

  const normalizedQuery = queryTerms.join(' ');
  const adapterName = memory.adapter?.name ?? memory.chain?.label ?? '';
  const activationPatterns = memory.activation_patterns ?? memory.adapter?.activation_patterns ?? memory.chain?.activation_patterns ?? [];

  const adapterScore = scoreText(queryTerms, normalizedQuery, adapterName, 0.35);
  const bestPatternScore = activationPatterns.reduce((best, pattern) => {
    return Math.max(best, scoreText(queryTerms, normalizedQuery, pattern, 0.3));
  }, 0);
  const labelScore = scoreText(queryTerms, normalizedQuery, memory.label, 0.12);
  const tagScore = Math.min(
    queryTerms.filter((term) => memory.tags.some((tag) => tag.toLowerCase() === term)).length * 0.05,
    0.1
  );

  return Math.min(adapterScore + bestPatternScore + labelScore + tagScore, 0.65);
}
