/**
 * Single export for cache/proof-of-work key-value store.
 * Uses networked KV backend when isRedisConfigured is true,
 * in-memory when it is false.
 */

import { isRedisConfigured } from '../config.js';
import type { IKeyValueStore } from './key-value-store.js';
import { MemoryStore } from './memory-store.js';
import { RedisService } from './redis.js';

function createKeyValueStore(): IKeyValueStore {
  if (!isRedisConfigured) {
    return new MemoryStore();
  }
  return new RedisService();
}

export const keyValueStore: IKeyValueStore = createKeyValueStore();
