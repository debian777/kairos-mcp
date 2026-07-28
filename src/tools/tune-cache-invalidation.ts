import type { TuneOutput } from './tune_schema.js';
import { redisCacheService } from '../services/redis-cache.js';

/**
 * Invalidate caches after tune writes.
 * Without this, subsequent reads (export, forward, activate) return stale
 * cached data even though Qdrant has the fresh write.
 */
export async function invalidateTuneCache(result: TuneOutput): Promise<void> {
  if (result.total_updated <= 0) return;
  await redisCacheService.invalidateAfterUpdate();
}
