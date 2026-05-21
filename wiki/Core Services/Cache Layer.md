# Cache Layer

<cite>
**Referenced Files in This Document**
- [redis-cache.ts](file://src/services/redis-cache.ts)
- [redis.ts](file://src/services/redis.ts)
- [key-value-store.ts](file://src/services/key-value-store.ts)
- [key-value-store-factory.ts](file://src/services/key-value-store-factory.ts)
- [memory-store.ts](file://src/services/memory-store.ts)
- [config.ts](file://src/config.ts)
- [redis-pubsub-integration.test.ts](file://tests/integration/redis-pubsub-integration.test.ts)
- [values.yaml](file://helm/kairos-mcp/values.yaml)
- [system-metrics.ts](file://src/services/metrics/system-metrics.ts)
- [registry.ts](file://src/services/metrics/registry.ts)
- [store.ts](file://src/services/memory/store.ts)
- [service.ts](file://src/services/embedding/service.ts)
- [health.ts](file://src/services/embedding/health.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction
This document explains the KAIROS MCP cache layer architecture with a focus on Redis integration for performance optimization. It covers connection handling, key-value operations, cache invalidation strategies, the key-value store factory pattern, cache tiering approaches, configuration, TTL management, eviction policies, memory management integration, and embedding services. Practical examples demonstrate cache configuration, monitoring hit rates, and troubleshooting performance issues. Distributed caching considerations and cache warming strategies are also addressed.

## Project Structure
The cache layer is implemented as a thin abstraction over Redis or an in-memory store. The key-value store interface is implemented by RedisService and MemoryStore. A factory selects the appropriate implementation at runtime based on environment configuration. RedisCacheService orchestrates cache reads/writes, TTLs, and invalidation events.

```mermaid
graph TB
subgraph "Cache Abstraction"
IF["IKeyValueStore<br/>Interface"]
RS["RedisService<br/>(Redis)"]
MS["MemoryStore<br/>(In-Memory)"]
F["keyValueStore<br/>Factory"]
end
subgraph "Cache Orchestrator"
RCS["RedisCacheService"]
end
subgraph "Integration"
CFG["config.ts<br/>Environment & Prefixes"]
MEM["MemoryQdrantStore<br/>(Qdrant)"]
EMB["EmbeddingService<br/>(Embeddings)"]
end
IF --> RS
IF --> MS
F --> RS
F --> MS
RCS --> IF
CFG --> RS
CFG --> MS
RCS --> MEM
RCS --> EMB
```

**Diagram sources**
- [redis-cache.ts:21-243](file://src/services/redis-cache.ts#L21-L243)
- [redis.ts:26-273](file://src/services/redis.ts#L26-L273)
- [memory-store.ts:23-178](file://src/services/memory-store.ts#L23-L178)
- [key-value-store.ts:7-24](file://src/services/key-value-store.ts#L7-L24)
- [key-value-store-factory.ts:12-19](file://src/services/key-value-store-factory.ts#L12-L19)
- [config.ts:54-66](file://src/config.ts#L54-L66)
- [store.ts:20-152](file://src/services/memory/store.ts#L20-L152)
- [service.ts:254-287](file://src/services/embedding/service.ts#L254-L287)

**Section sources**
- [redis-cache.ts:1-243](file://src/services/redis-cache.ts#L1-L243)
- [redis.ts:1-273](file://src/services/redis.ts#L1-L273)
- [memory-store.ts:1-178](file://src/services/memory-store.ts#L1-L178)
- [key-value-store.ts:1-25](file://src/services/key-value-store.ts#L1-L25)
- [key-value-store-factory.ts:1-20](file://src/services/key-value-store-factory.ts#L1-L20)
- [config.ts:54-66](file://src/config.ts#L54-L66)

## Core Components
- IKeyValueStore: Defines the cache API used by RedisCacheService, including get/set/del, JSON helpers, hash ops, counters, existence checks, key enumeration, pub/sub, and lifecycle methods.
- RedisService: Implements IKeyValueStore against Redis, applying a configurable prefix and per-space namespacing. It supports TTL, JSON serialization, and pub/sub channels.
- MemoryStore: Provides an in-memory implementation for development without Redis, mirroring RedisService behavior including TTL and glob-based key enumeration.
- RedisCacheService: Orchestrates cache keys for search results and memory resources, manages TTLs, increments hit/miss counters, and publishes invalidation events.
- Factory: keyValueStore selects RedisService when a Redis URL is configured; otherwise, MemoryStore is used.

Key-value operations:
- Namespacing: Keys are prefixed with a configurable prefix and, for non-memory keys, further namespaced by the current space identifier.
- JSON: Convenience methods serialize/deserialize cached values.
- TTL: Search results are cached with a fixed TTL; memory resources are stored without TTL.
- Pub/Sub: Invalidations are broadcast on a dedicated channel for distributed invalidation awareness.

**Section sources**
- [key-value-store.ts:7-24](file://src/services/key-value-store.ts#L7-L24)
- [redis.ts:111-117](file://src/services/redis.ts#L111-L117)
- [memory-store.ts:36-42](file://src/services/memory-store.ts#L36-L42)
- [redis-cache.ts:31-34](file://src/services/redis-cache.ts#L31-L34)
- [redis-cache.ts:54-66](file://src/services/redis-cache.ts#L54-L66)
- [redis-cache.ts:175-184](file://src/services/redis-cache.ts#L175-L184)
- [redis-cache.ts:114-125](file://src/services/redis-cache.ts#L114-L125)
- [key-value-store-factory.ts:12-19](file://src/services/key-value-store-factory.ts#L12-L19)

## Architecture Overview
The cache layer sits between application logic and persistent stores. RedisCacheService uses keyValueStore to read/write cache entries. RedisService handles connection lifecycle and command execution, while MemoryStore provides a dev-friendly alternative. Configuration controls the key prefix and whether Redis is used.

```mermaid
sequenceDiagram
participant App as "Application"
participant RCS as "RedisCacheService"
participant KVS as "keyValueStore"
participant RS as "RedisService"
participant MS as "MemoryStore"
App->>RCS : getSearchResult(query, limit, opts)
alt Redis enabled
RCS->>RS : getJson(key)
RS-->>RCS : cached result or null
else In-memory
RCS->>MS : getJson(key)
MS-->>RCS : cached result or null
end
alt cache hit
RCS->>RCS : incrementHits()
RCS-->>App : CachedSearchResult
else cache miss
RCS->>RCS : incrementMisses()
RCS-->>App : null
end
```

**Diagram sources**
- [redis-cache.ts:36-52](file://src/services/redis-cache.ts#L36-L52)
- [redis.ts:119-126](file://src/services/redis.ts#L119-L126)
- [memory-store.ts:49-58](file://src/services/memory-store.ts#L49-L58)

**Section sources**
- [redis-cache.ts:36-70](file://src/services/redis-cache.ts#L36-L70)
- [redis.ts:119-126](file://src/services/redis.ts#L119-L126)
- [memory-store.ts:49-58](file://src/services/memory-store.ts#L49-L58)

## Detailed Component Analysis

### RedisCacheService
Responsibilities:
- Build cache keys for search queries with mode and limit.
- Retrieve and store search results with TTL.
- Manage hit/miss counters and expose statistics.
- Invalidate caches for search, begin/activate, and memory resources.
- Publish invalidation events to a pub/sub channel.

Key behaviors:
- Search cache key composition includes mode (collapsed/natural), query, and limit.
- Search results are cached with a fixed TTL.
- Memory resources are cached without TTL and are globally keyed by UUID.
- Invalidation clears keys matching patterns and publishes events.

```mermaid
classDiagram
class RedisCacheService {
-string cachePrefix
-string invalidationChannel
-string statsPrefix
-string memoryPrefix
+getSearchResult(query, limit, opts) CachedSearchResult|null
+setSearchResult(query, limit, result, opts) void
+invalidateSearchCache() void
+invalidateMemoryCache(uuid) void
+invalidateBeginCache() void
+invalidateAfterUpdate() void
+incrementHits() void
+incrementMisses() void
+getCacheStats() {hits, misses}
+get(key) string|null
+set(key, value, ttl?) void
}
```

**Diagram sources**
- [redis-cache.ts:21-243](file://src/services/redis-cache.ts#L21-L243)

**Section sources**
- [redis-cache.ts:31-70](file://src/services/redis-cache.ts#L31-L70)
- [redis-cache.ts:72-95](file://src/services/redis-cache.ts#L72-L95)
- [redis-cache.ts:97-112](file://src/services/redis-cache.ts#L97-L112)
- [redis-cache.ts:186-211](file://src/services/redis-cache.ts#L186-L211)
- [redis-cache.ts:214-221](file://src/services/redis-cache.ts#L214-L221)
- [redis-cache.ts:127-157](file://src/services/redis-cache.ts#L127-L157)
- [redis-cache.ts:223-240](file://src/services/redis-cache.ts#L223-L240)

### RedisService
Responsibilities:
- Implement IKeyValueStore against Redis.
- Apply key prefixing and per-space namespacing.
- Support TTL, JSON serialization, hash operations, counters, key enumeration, and pub/sub.
- Manage connection lifecycle and emit logs for connection events.

Key behaviors:
- Namespaces keys by prefix and current space; memory cache keys bypass space namespacing.
- Uses EX variant for TTL on SET; JSON helpers wrap stringify/parse.
- Publishes to channels without prefixing to enable cross-instance communication.

```mermaid
classDiagram
class RedisService {
-RedisClientType client
-string prefix
-boolean connected
-string redisUrl
-string maskedRedisUrl
+connect() void
+disconnect() void
+get(key) string|null
+set(key, value, ttl?) void
+del(key) void
+hget(hash, field) string|null
+hset(hash, field, value) void
+hgetall(hash) Record
+hsetall(hash, data) void
+incr(key) number
+exists(key) boolean
+keys(pattern) string[]
+publish(channel, message) number
+getJson(key) T|null
+setJson(key, value, ttl?) void
+isConnected() boolean
}
```

**Diagram sources**
- [redis.ts:26-273](file://src/services/redis.ts#L26-L273)

**Section sources**
- [redis.ts:111-117](file://src/services/redis.ts#L111-L117)
- [redis.ts:128-138](file://src/services/redis.ts#L128-L138)
- [redis.ts:229-247](file://src/services/redis.ts#L229-L247)
- [redis.ts:217-226](file://src/services/redis.ts#L217-L226)
- [redis.ts:269-272](file://src/services/redis.ts#L269-L272)

### MemoryStore
Responsibilities:
- Provide an in-memory implementation of IKeyValueStore for development.
- Mirror RedisService behavior including TTL, JSON, hashes, counters, and key enumeration.
- No cross-process invalidation via pub/sub.

Key behaviors:
- Namespaces keys similarly to RedisService, except memory cache keys are global.
- TTL entries expire based on absolute timestamps.
- Glob-based key enumeration supports pattern matching.

```mermaid
classDiagram
class MemoryStore {
-string prefix
-Map~string,TtlEntry~ strings
-Map~string,Map~string,string~~ hashes
-Map~string,number~ counters
-boolean connected
+connect() void
+disconnect() void
+get(key) string|null
+set(key, value, ttl?) void
+del(key) void
+getJson(key) T|null
+setJson(key, value, ttl?) void
+hget(hash, field) string|null
+hset(hash, field, value) void
+hgetall(hash) Record
+hsetall(hash, data) void
+incr(key) number
+exists(key) boolean
+keys(pattern) string[]
+publish(channel, message) number
+isConnected() boolean
}
```

**Diagram sources**
- [memory-store.ts:23-178](file://src/services/memory-store.ts#L23-L178)

**Section sources**
- [memory-store.ts:36-42](file://src/services/memory-store.ts#L36-L42)
- [memory-store.ts:60-64](file://src/services/memory-store.ts#L60-L64)
- [memory-store.ts:73-91](file://src/services/memory-store.ts#L73-L91)
- [memory-store.ts:146-160](file://src/services/memory-store.ts#L146-L160)
- [memory-store.ts:162-164](file://src/services/memory-store.ts#L162-L164)

### Key-Value Store Factory Pattern
The factory chooses the implementation at runtime:
- If a Redis URL is configured, RedisService is used.
- Otherwise, MemoryStore is used for local development.

```mermaid
flowchart TD
Start(["Process Start"]) --> CheckURL["Read KEY_VALUE_STORE_URL/REDIS_URL"]
CheckURL --> |Non-empty| UseRedis["Use RedisService"]
CheckURL --> |Empty| UseMemory["Use MemoryStore"]
UseRedis --> Export["Export keyValueStore"]
UseMemory --> Export
Export --> End(["Runtime"])
```

**Diagram sources**
- [key-value-store-factory.ts:12-19](file://src/services/key-value-store-factory.ts#L12-L19)
- [config.ts:52-54](file://src/config.ts#L52-L54)

**Section sources**
- [key-value-store-factory.ts:12-19](file://src/services/key-value-store-factory.ts#L12-L19)
- [config.ts:52-54](file://src/config.ts#L52-L54)

### Cache Invalidation Strategies
RedisCacheService publishes invalidation events to a channel for distributed systems. Tests confirm that invalidation events are published for both search and memory operations.

```mermaid
sequenceDiagram
participant RCS as "RedisCacheService"
participant KVS as "keyValueStore"
participant RS as "RedisService"
participant Sub as "Subscriber"
RCS->>KVS : del(memoryKey)
RCS->>RS : publish("cache : invalidation", "{type,timestamp}")
RS-->>Sub : deliver message
Sub-->>Sub : handle invalidation
```

**Diagram sources**
- [redis-cache.ts:97-125](file://src/services/redis-cache.ts#L97-L125)
- [redis.ts:217-226](file://src/services/redis.ts#L217-L226)
- [redis-pubsub-integration.test.ts:118-147](file://tests/integration/redis-pubsub-integration.test.ts#L118-L147)

**Section sources**
- [redis-cache.ts:97-125](file://src/services/redis-cache.ts#L97-L125)
- [redis.ts:217-226](file://src/services/redis.ts#L217-L226)
- [redis-pubsub-integration.test.ts:118-147](file://tests/integration/redis-pubsub-integration.test.ts#L118-L147)

### Cache Tiering Approaches
- Hot cache: Search results cached with TTL.
- Warm cache: Memory resources cached without TTL.
- Cold cache: Not explicitly modeled; consider using Redis with TTL for transient data if needed.

Implementation notes:
- Search results: TTL enforced by RedisService.
- Memory resources: Stored without TTL; suitable for long-lived references.

**Section sources**
- [redis-cache.ts:54-70](file://src/services/redis-cache.ts#L54-L70)
- [redis-cache.ts:175-184](file://src/services/redis-cache.ts#L175-L184)
- [redis.ts:128-138](file://src/services/redis.ts#L128-L138)

### Cache Configuration, TTL Management, and Eviction Policies
- Prefix and memory cache key prefix are controlled by environment variables.
- Search results TTL is fixed at a compile-time constant in RedisCacheService.
- Memory resources are stored without TTL.
- RedisService applies TTL via EX variant; MemoryStore tracks expiration via timestamps.

Operational guidance:
- Adjust TTL for search results by modifying the constant in RedisCacheService.
- For MemoryStore, TTL is enforced by checking expiration timestamps on access.

**Section sources**
- [config.ts:54-66](file://src/config.ts#L54-L66)
- [redis-cache.ts:54-70](file://src/services/redis-cache.ts#L54-L70)
- [redis-cache.ts:175-184](file://src/services/redis-cache.ts#L175-L184)
- [redis.ts:128-138](file://src/services/redis.ts#L128-L138)
- [memory-store.ts:44-47](file://src/services/memory-store.ts#L44-L47)
- [memory-store.ts:60-64](file://src/services/memory-store.ts#L60-L64)

### Integration with Memory Management and Embedding Services
- Memory management: RedisCacheService interacts with MemoryQdrantStore for retrieval and updates. Invalidation is triggered after updates to maintain consistency.
- Embedding services: Health checks and configuration inform embedding dimension probing and readiness, indirectly supporting cache warming and performance.

```mermaid
graph LR
RCS["RedisCacheService"] --> MQS["MemoryQdrantStore"]
RCS --> EMB["EmbeddingService"]
EMB --> DIM["Embedding Dimension Probe"]
```

**Diagram sources**
- [redis-cache.ts:214-221](file://src/services/redis-cache.ts#L214-L221)
- [store.ts:135-144](file://src/services/memory/store.ts#L135-L144)
- [service.ts:254-287](file://src/services/embedding/service.ts#L254-L287)
- [health.ts:35-58](file://src/services/embedding/health.ts#L35-L58)

**Section sources**
- [redis-cache.ts:214-221](file://src/services/redis-cache.ts#L214-L221)
- [store.ts:135-144](file://src/services/memory/store.ts#L135-L144)
- [service.ts:254-287](file://src/services/embedding/service.ts#L254-L287)
- [health.ts:35-58](file://src/services/embedding/health.ts#L35-L58)

## Dependency Analysis
The cache layer depends on configuration for prefixes and backend selection, and integrates with memory and embedding services.

```mermaid
graph TB
CFG["config.ts"] --> F["key-value-store-factory.ts"]
F --> RS["redis.ts"]
F --> MS["memory-store.ts"]
RS --> RCS["redis-cache.ts"]
MS --> RCS
RCS --> MQS["memory/store.ts"]
RCS --> EMB["embedding/service.ts"]
```

**Diagram sources**
- [config.ts:54-66](file://src/config.ts#L54-L66)
- [key-value-store-factory.ts:12-19](file://src/services/key-value-store-factory.ts#L12-L19)
- [redis.ts:26-273](file://src/services/redis.ts#L26-L273)
- [memory-store.ts:23-178](file://src/services/memory-store.ts#L23-L178)
- [redis-cache.ts:1-243](file://src/services/redis-cache.ts#L1-L243)
- [store.ts:20-152](file://src/services/memory/store.ts#L20-L152)
- [service.ts:254-287](file://src/services/embedding/service.ts#L254-L287)

**Section sources**
- [config.ts:54-66](file://src/config.ts#L54-L66)
- [key-value-store-factory.ts:12-19](file://src/services/key-value-store-factory.ts#L12-L19)
- [redis-cache.ts:1-243](file://src/services/redis-cache.ts#L1-L243)

## Performance Considerations
- Connection handling: RedisService emits connection lifecycle logs and exposes isConnected for monitoring.
- Namespacing: Per-space keys prevent collisions across tenants; memory cache keys remain global for UUID-based access.
- TTL and eviction: Redis manages eviction policies; MemoryStore relies on TTL checks on access.
- Pub/Sub invalidation: Enables distributed invalidation across instances.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and remedies:
- Redis connectivity failures: Inspect connection logs and error events emitted by RedisService.
- Cache invalidation not observed: Verify pub/sub channel subscriptions and that publish is invoked on invalidation.
- Memory cache misses: Confirm global memory cache keys and absence of TTL for memory resources.
- Monitoring cache hit rates: Use RedisCacheService statistics and Prometheus metrics.

Practical references:
- Connection lifecycle and error logging in RedisService.
- Invalidation event publishing and consumption in tests.
- Prometheus metrics registry and system metrics.

**Section sources**
- [redis.ts:47-84](file://src/services/redis.ts#L47-L84)
- [redis-cache.ts:114-125](file://src/services/redis-cache.ts#L114-L125)
- [redis-pubsub-integration.test.ts:118-147](file://tests/integration/redis-pubsub-integration.test.ts#L118-L147)
- [registry.ts:11-21](file://src/services/metrics/registry.ts#L11-L21)
- [system-metrics.ts:1-41](file://src/services/metrics/system-metrics.ts#L1-L41)

## Conclusion
The cache layer provides a clean abstraction over Redis or an in-memory store, enabling consistent caching semantics across environments. RedisCacheService centralizes cache orchestration, TTL management, and invalidation events. Configuration controls backend selection and key prefixes, while integration with memory and embedding services ensures coherent performance characteristics. The design supports distributed invalidation via pub/sub and offers practical mechanisms for monitoring and troubleshooting.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Practical Examples

- Cache configuration
  - Backend selection: Set KEY_VALUE_STORE_URL (or REDIS_URL) to enable Redis; leave unset for in-memory store.
  - Prefix: Configure KAIROS_KEY_VALUE_PREFIX (or KAIROS_REDIS_PREFIX) to isolate keys.
  - Memory cache prefix: MEMORY_CACHE_KEY_PREFIX defines global memory cache keys.

  **Section sources**
  - [config.ts:52-55](file://src/config.ts#L52-L55)
  - [config.ts:65-66](file://src/config.ts#L65-L66)
  - [key-value-store-factory.ts:12-19](file://src/services/key-value-store-factory.ts#L12-L19)

- Monitoring cache hit rates
  - Use RedisCacheService.getCacheStats to retrieve hits and misses counters.
  - Expose metrics via Prometheus using the registry and system metrics.

  **Section sources**
  - [redis-cache.ts:143-157](file://src/services/redis-cache.ts#L143-L157)
  - [registry.ts:11-21](file://src/services/metrics/registry.ts#L11-L21)
  - [system-metrics.ts:10-41](file://src/services/metrics/system-metrics.ts#L10-L41)

- Troubleshooting cache-related performance issues
  - Validate Redis connectivity and error logs.
  - Confirm TTL behavior for search results and absence of TTL for memory resources.
  - Verify pub/sub invalidation delivery in distributed deployments.

  **Section sources**
  - [redis.ts:47-84](file://src/services/redis.ts#L47-L84)
  - [redis-cache.ts:54-70](file://src/services/redis-cache.ts#L54-L70)
  - [redis-cache.ts:175-184](file://src/services/redis-cache.ts#L175-L184)
  - [redis-pubsub-integration.test.ts:118-147](file://tests/integration/redis-pubsub-integration.test.ts#L118-L147)

- Cache consistency and distributed caching
  - Use Redis pub/sub channel "cache:invalidation" for cross-instance invalidation.
  - Helm values support multi-replica deployments; ensure Redis availability for consistent invalidation.

  **Section sources**
  - [redis-cache.ts:114-125](file://src/services/redis-cache.ts#L114-L125)
  - [values.yaml:42-42](file://helm/kairos-mcp/values.yaml#L42-L42)

- Cache warming strategies
  - Preload frequently accessed memory resources by calling setMemoryResource with representative data.
  - Warm search cache by proactively invoking setSearchResult with common queries and limits.

  **Section sources**
  - [redis-cache.ts:175-184](file://src/services/redis-cache.ts#L175-L184)
  - [redis-cache.ts:54-70](file://src/services/redis-cache.ts#L54-L70)