/**
 * Pure helpers for reconciling adapter layer_count with Qdrant adapter points.
 */

type AdapterPointLike = {
  payload?: {
    adapter?: { layer_index?: number };
  };
};

/** Largest layer index seen on adapter points (0 if none). */
export function maxLayerIndexFromAdapterPoints(points: AdapterPointLike[]): number {
  let max = 0;
  for (const pt of points) {
    const layerIndex = pt.payload?.adapter?.layer_index;
    if (typeof layerIndex === 'number' && layerIndex > max) max = layerIndex;
  }
  return max;
}

/**
 * Trust Qdrant adapter points over embedded layer_count when they disagree (Redis/process cache
 * can serve a stale layer_count while siblings still exist in Qdrant).
 */
export function effectiveAdapterLayerCount(
  points: AdapterPointLike[],
  memoryLayerCount: number | undefined
): number {
  const fromMemory = typeof memoryLayerCount === 'number' && memoryLayerCount >= 1 ? memoryLayerCount : 0;
  const fromPayload = maxLayerIndexFromAdapterPoints(points);
  return Math.max(fromMemory, fromPayload);
}
