Two-layer design inside the module:

- Backend abstraction: `IKeyValueStore` (`key-value-store.ts`) defines the contract (string/hash/JSON ops, atomic getdel, incr, keys/publish). `MemoryStore` (`memory-store.ts`) implements it with per-process Maps plus TTL via expiry timestamps; `RedisService` (imported from `./redis.js`) is the production backend. `key-value-store-factory.ts` selects between them at import time based on `isRedisConfigured`, exporting a single shared singleton `keyValueStore`. Key namespacing is handled by `MemoryStore.getKey()`, which prefixes with `KAIROS_REDIS_PREFIX` and either a space id (via `getSpaceIdFromStorage`) or special global prefixes (`MEMORY_CACHE_KEY_PREFIX`, `OIDC_STATE_KEY_PREFIX`).

- Domain stores that compose `keyValueStore`: each file owns one concern and exports a singleton instance — `OidcStateStore` (PKCE code_verifier + state token, global keys, atomic consume via `getdelJson`), `ProofOfWorkStore` (nonce/hash/retry counters with fixed TTLs), `ForwardRuntimeStore` (execution metadata + named tensor values under `runtime:execution:*` keys).

- Separate persistence target: `ExecutionTraceStore` does NOT use `IKeyValueStore`; it connects directly to Qdrant via `QdrantConnection`, lazily ensures its collection exists, and serializes trace payloads as Qdrant points keyed by execution id.

Dependency direction: domain stores → factory → IKeyValueStore implementation; ExecutionTraceStore depends only on config and Qdrant client. No cross-dependencies between domain stores.