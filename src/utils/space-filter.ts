/**
 * Build Qdrant filter for space isolation. Merges space_id constraint with optional existing filter.
 */

/** Qdrant filter shape (must array of conditions). */
export interface QdrantFilterMust {
  must?: Array<Record<string, unknown>>;
}

/**
 * Build a filter that restricts results to points whose space_id is in allowedSpaceIds.
 * Merges with existingFilter.must so callers can add domain, chain.id, etc.
 */
export function buildSpaceFilter(
  allowedSpaceIds: string[],
  existingFilter?: QdrantFilterMust
): { must: Array<Record<string, unknown>> } {
  const spaceCondition = {
    key: 'space_id',
    match: { any: allowedSpaceIds }
  };
  const existingMust = existingFilter?.must ?? [];
  return {
    must: [spaceCondition, ...existingMust]
  };
}
