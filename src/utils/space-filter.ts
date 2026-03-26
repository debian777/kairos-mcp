/**
 * Build Qdrant filter for space isolation. Merges space_id constraint with optional existing filter.
 */

/** Qdrant filter shape (must array of conditions). */
export interface QdrantFilterMust {
  must?: Array<Record<string, unknown>>;
}

/**
 * Build a filter that restricts results to points whose space_id is in allowedSpaceIds.
 * Merges with existingFilter.must so callers can add domain, adapter.id, etc.
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

/**
 * Scroll filter for adapter siblings: same `adapter.id` and either `space_id` in the allowed set
 * or older rows with no `space_id` payload (Qdrant `match any` does not match missing payload keys).
 */
export function buildAdapterSiblingScrollFilter(
  allowedSpaceIds: string[],
  adapterId: string
): { must: Array<Record<string, unknown>> } {
  return {
    must: [
      { key: 'adapter.id', match: { value: adapterId } },
      {
        should: [
          { key: 'space_id', match: { any: allowedSpaceIds } },
          { is_empty: { key: 'space_id' } }
        ]
      }
    ]
  };
}
