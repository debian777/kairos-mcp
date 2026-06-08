import type { TuneOutput } from './tune_schema.js';

/**
 * Invalidate the in-process MemoryQdrantStore cache after tune writes.
 * Without this, subsequent reads (export, forward, activate) return stale
 * cached data even though Qdrant has the fresh write. PR #545 fixed Redis
 * cache invalidation but missed this in-process Map layer.
 */
export function invalidateTuneInProcessCache(memoryStore: unknown, result: TuneOutput): void {
  if (result.total_updated <= 0) return;
  const methods = (memoryStore as any)?.methods;
  if (methods && typeof methods.invalidateLocalCache === 'function') {
    methods.invalidateLocalCache();
  }
}
