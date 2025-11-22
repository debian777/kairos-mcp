import type { Memory } from '../types/memory.js';
import { logger } from '../utils/logger.js';
import { redisService } from './redis.js';

export interface SearchResult {
  memories: Memory[];
  scores: number[];
}

export interface CachedSearchResult {
  results: Array<{
    uri: string;
    label: string;
    score: number;
  }>;
}

export class RedisCacheService {
  private cachePrefix = 'search:';
  private invalidationChannel = 'cache:invalidation';
  private statsPrefix = 'stats:';
  private memoryPrefix = 'mem:';

  constructor() {
    logger.info('[RedisCacheService] Initialized with RedisService');
  }

  private getCacheKey(query: string, limit: number, opts?: { collapse?: boolean }): string {
    const mode = opts && typeof opts.collapse === 'boolean' ? (opts.collapse ? 'collapsed' : 'natural') : 'collapsed';
    return `${this.cachePrefix}${mode}:${query}:${limit}`;
  }

  async getSearchResult(query: string, limit: number, opts?: { collapse?: boolean }): Promise<CachedSearchResult | null> {
    try {
      const key = this.getCacheKey(query, limit, opts);
      const cached = await redisService.getJson<CachedSearchResult>(key);
      if (cached) {
        logger.debug(`[RedisCacheService] Cache hit for query "${query}" limit ${limit}`);
        await this.incrementHits();
        return cached;
      }
      logger.debug(`[RedisCacheService] Cache miss for query "${query}" limit ${limit}`);
      await this.incrementMisses();
      return null;
    } catch (error) {
      logger.error('[RedisCacheService] Failed to get search result from cache:', error);
      return null;
    }
  }

  async setSearchResult(query: string, limit: number, result: SearchResult, opts?: { collapse?: boolean }): Promise<void> {
    try {
      const key = this.getCacheKey(query, limit, opts);
      const ttl = 300; // 5 minutes
      const cachedResult: CachedSearchResult = {
        results: result.memories.map((memory, index) => ({
          uri: `kairos://mem/${memory.memory_uuid}`,
          label: memory.label,
          score: result.scores[index] ?? 0
        }))
      };
      await redisService.setJson(key, cachedResult, ttl);
      logger.debug(`[RedisCacheService] Cached search result for query "${query}" limit ${limit}`);
    } catch (error) {
      logger.error('[RedisCacheService] Failed to set search result in cache:', error);
    }
  }

  async invalidateSearchCache(): Promise<void> {
    try {
      logger.info(`[RedisCacheService] Search cache invalidation requested`);
      // Delete keys matching search cache pattern (all collapse modes)
      const keys = await redisService.keys(`${this.cachePrefix}*`);
      if (!keys || keys.length === 0) {
        logger.debug('[RedisCacheService] No search cache keys to delete');
        return;
      }
      // The redisService.del expects key without prefix; we return fully-qualified keys from keys(), so we need to strip prefix before deleting via redisService.del.
      const prefix = redisService['prefix'] || '';
      const stripped: string[] = keys.map(k => k.startsWith(prefix) ? k.slice(prefix.length) : k);
      await Promise.all(stripped.map(k => redisService.del(k)));
      logger.info(`[RedisCacheService] Invalidated ${stripped.length} search cache keys`);
    } catch (error) {
      logger.error('[RedisCacheService] Failed to invalidate search cache:', error);
    }
  }

  // Remove cached memory by UUID (kb:<prefix>mem:{uuid})
  async invalidateMemoryCache(uuid: string): Promise<void> {
    try {
      if (!uuid || typeof uuid !== 'string') {
        logger.warn('[RedisCacheService] invalidateMemoryCache called with invalid uuid');
        return;
      }
      const key = `${this.memoryPrefix}${uuid}`;
      await redisService.del(key);
      logger.debug(`[RedisCacheService] Invalidated memory cache for UUID ${uuid}`);
    } catch (error) {
      logger.error('[RedisCacheService] Failed to invalidate memory cache:', error);
    }
  }

  async publishInvalidation(type: string): Promise<void> {
    try {
      // Publishing not implemented in RedisService wrapper
      logger.debug(`[RedisCacheService] Invalidation event: ${type} (not published)`);
    } catch (error) {
      logger.error('[RedisCacheService] Failed to publish invalidation:', error);
    }
  }

  async incrementHits(): Promise<void> {
    try {
      await redisService.incr(`${this.statsPrefix}hits`);
    } catch (error) {
      logger.error('[RedisCacheService] Failed to increment hits:', error);
    }
  }

  async incrementMisses(): Promise<void> {
    try {
      await redisService.incr(`${this.statsPrefix}misses`);
    } catch (error) {
      logger.error('[RedisCacheService] Failed to increment misses:', error);
    }
  }

  async getCacheStats(): Promise<{ hits: number; misses: number }> {
    try {
      const [hits, misses] = await Promise.all([
        redisService.get(`${this.statsPrefix}hits`),
        redisService.get(`${this.statsPrefix}misses`)
      ]);
      return {
        hits: parseInt(hits || '0', 10),
        misses: parseInt(misses || '0', 10)
      };
    } catch (error) {
      logger.error('[RedisCacheService] Failed to get cache stats:', error);
      return { hits: 0, misses: 0 };
    }
  }

  // Memory resource caching methods
  async getMemoryResource(uuid: string): Promise<Memory | null> {
    try {
      const key = `${this.memoryPrefix}${uuid}`;
      const cached = await redisService.getJson<Memory>(key);
      if (cached) {
        logger.debug(`[RedisCacheService] Memory cache hit for UUID ${uuid}`);
        return cached;
      }
      return null;
    } catch (error) {
      logger.error('[RedisCacheService] Failed to get memory from cache:', error);
      return null;
    }
  }

  async setMemoryResource(memory: Memory): Promise<void> {
    try {
      const key = `${this.memoryPrefix}${memory.memory_uuid}`;
      const ttl = 3600; // 1 hour for memory resources
      await redisService.setJson(key, memory, ttl);
      logger.debug(`[RedisCacheService] Cached memory resource for UUID ${memory.memory_uuid}`);
    } catch (error) {
      logger.error('[RedisCacheService] Failed to cache memory resource:', error);
    }
  }

  // For atomic operations as per plan
  async invalidateAfterUpdate(): Promise<void> {
    // Simplified invalidation - just log for now
    logger.debug('[RedisCacheService] Cache invalidation after update requested');
  }

  // Generic get and set methods for arbitrary caching
  async get(key: string): Promise<string | null> {
    try {
      return await redisService.get(key);
    } catch (error) {
      logger.error('[RedisCacheService] Failed to get from cache:', error);
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      await redisService.set(key, value, ttl);
    } catch (error) {
      logger.error('[RedisCacheService] Failed to set in cache:', error);
    }
  }
}

export const redisCacheService = new RedisCacheService();
