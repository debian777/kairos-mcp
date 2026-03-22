/**
 * Pure helpers for reconciling chain step_count with Qdrant chain points.
 */

/** Largest step_index seen on chain points (0 if none). */
export function maxStepIndexFromChainPoints(points: Array<{ payload?: { chain?: { step_index?: number } } }>): number {
  let max = 0;
  for (const pt of points) {
    const step = pt.payload?.chain?.step_index;
    if (typeof step === 'number' && step > max) max = step;
  }
  return max;
}

/**
 * Trust Qdrant chain points over embedded step_count when they disagree (Redis/process cache
 * can serve a stale step_count while siblings still exist in Qdrant).
 */
export function effectiveChainStepCount(
  points: Array<{ payload?: { chain?: { step_index?: number } } }>,
  memoryStepCount: number | undefined
): number {
  const fromMemory = typeof memoryStepCount === 'number' && memoryStepCount >= 1 ? memoryStepCount : 0;
  const fromPayload = maxStepIndexFromChainPoints(points);
  return Math.max(fromMemory, fromPayload);
}
