/**
 * Key-value store abstraction for cache and proof-of-work state.
 * Implementations: Redis (production) or in-memory (dev/simple setups without Redis).
 */

/** Matches RedisService API: prefix + space namespacing applied by implementation. */
export interface IKeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  getJson<T>(key: string): Promise<T | null>;
  setJson<T>(key: string, value: T, ttl?: number): Promise<void>;
  hget(hash: string, field: string): Promise<string | null>;
  hset(hash: string, field: string, value: string): Promise<void>;
  hgetall(hash: string): Promise<Record<string, string> | null>;
  hsetall(hash: string, data: Record<string, string>): Promise<void>;
  incr(key: string): Promise<number>;
  exists(key: string): Promise<boolean>;
  keys(pattern: string): Promise<string[]>;
  publish(channel: string, message: string): Promise<number>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}
