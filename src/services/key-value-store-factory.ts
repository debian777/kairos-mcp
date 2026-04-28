/**
 * Single export for cache/proof-of-work key-value store.
 * Uses Redis when REDIS_URL is set (non-empty), in-memory when REDIS_URL is unset or empty.
 */

import { REDIS_URL } from '../config.js';
import type { IKeyValueStore } from './key-value-store.js';
import { MemoryStore } from './memory-store.js';
import { RedisService } from './redis.js';

function createKeyValueStore(): IKeyValueStore {
  if (!REDIS_URL) {
    return new MemoryStore();
  }
  return new RedisService();
}

export const keyValueStore: IKeyValueStore = createKeyValueStore();
