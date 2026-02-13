# Cold Cache Memory Store - Scalable Refactoring Plan

## Problem Statement

The current `MemoryQdrantStoreMethods.searchMemories()` implementation has a critical scaling issue:

1. **Cold Cache Problem**: On first search, `ensureCache()` loads ALL memories from Qdrant into in-memory cache
2. **Memory Bloat**: Entire collection stored in RAM (doesn't scale beyond ~10K-100K memories)
3. **Slow First Query**: Initial search blocks while loading entire dataset
4. **Inefficient**: Loads everything even when only need top-N results
5. **No Vector Search**: Uses in-memory scoring instead of Qdrant's optimized vector similarity search

## Current Architecture Issues

```typescript
// Current: Loads ALL memories, then scores in-memory
async searchMemories(query, limit) {
  await this.ensureCache(); // ❌ Loads ALL memories
  const scored = Array.from(this.cache.values()).map(...); // ❌ In-memory scoring
  return filtered.slice(0, limit);
}
```

**Problems:**
- `ensureCache()` scrolls through entire Qdrant collection (128 points per page)
- For 100K memories = ~780 API calls to Qdrant on first search
- Memory usage: ~100MB-1GB+ depending on memory size
- First query latency: 5-30+ seconds for large collections

## Solution: Hybrid Vector + Keyword Search

### Phase 1: Replace Cold Cache with Qdrant Vector Search (High Priority)

**Goal**: Use Qdrant's native vector search instead of loading everything

**Implementation:**
1. Generate query embedding using `embeddingService`
2. Use `QdrantService.searchMemory()` for vector similarity search
3. Apply in-memory scoring only to top-N results (e.g., top 100-200)
4. Remove `ensureCache()` dependency from `searchMemories()`

**Benefits:**
- ✅ O(1) query time regardless of collection size
- ✅ Leverages Qdrant's optimized vector search
- ✅ Memory efficient (only loads top results)
- ✅ Scales to millions of memories

**Code Changes:**
```typescript
// New: Use vector search, then refine with scoring
async searchMemories(query: string, limit: number, collapse: boolean = true) {
  // 1. Generate embedding for query
  const embedding = await embeddingService.generateEmbedding(query);
  
  // 2. Vector search in Qdrant (returns top candidates)
  const vectorResults = await this.client.search(this.collection, {
    vector: { name: `vs${embedding.length}`, vector: embedding },
    limit: Math.min(limit * 3, 200), // Overfetch for better recall
    with_payload: true,
    with_vector: false
  });
  
  // 3. Convert to Memory objects
  const candidates = vectorResults.map(r => this.pointToMemory(r));
  
  // 4. Apply semantic scoring to refine results
  const scored = candidates.map(memory => ({
    memory,
    score: scoreMemory(memory, normalizedQuery)
  }));
  
  // 5. Sort, filter, and return top-N
  return scored
    .filter(e => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
```

### Phase 2: Hybrid Search with Keyword Fallback (Medium Priority)

**Goal**: Combine vector search with keyword matching for better recall

**Implementation:**
1. Primary: Vector similarity search (semantic)
2. Fallback: Keyword search if vector results insufficient
3. Merge and deduplicate results

**Benefits:**
- ✅ Better recall for exact matches
- ✅ Handles queries with specific terms
- ✅ Maintains semantic understanding

**Code Changes:**
```typescript
async searchMemories(query: string, limit: number) {
  // 1. Vector search (primary)
  const vectorResults = await this.vectorSearch(query, limit * 2);
  
  // 2. Keyword search (fallback if needed)
  if (vectorResults.length < limit) {
    const keywordResults = await this.keywordSearch(query, limit);
    // Merge and deduplicate
    return this.mergeResults(vectorResults, keywordResults, limit);
  }
  
  return vectorResults;
}

private async keywordSearch(query: string, limit: number) {
  // Use Qdrant filter with keyword matching on label/text
  const results = await this.client.scroll(this.collection, {
    filter: {
      should: [
        { key: 'label', match: { text: query } },
        { key: 'text', match: { text: query } }
      ]
    },
    limit,
    with_payload: true
  });
  return results.points.map(p => this.pointToMemory(p));
}
```

### Phase 3: Smart Caching Strategy (Medium Priority)

**Goal**: Cache intelligently without loading everything

**Implementation:**
1. **Redis Cache**: Cache search results (already exists, enhance it)
2. **LRU Cache**: Hot memory cache (individual memories, not all)
3. **Lazy Loading**: Load memories on-demand, not preemptively

**Cache Layers:**
```
┌─────────────────────────────────────┐
│  Redis Cache (Search Results)      │ ← Already exists, keep it
│  TTL: 5-15 minutes                  │
└─────────────────────────────────────┘
           ↓ Cache miss
┌─────────────────────────────────────┐
│  Qdrant Vector Search               │ ← Primary search method
│  Returns top-N candidates           │
└─────────────────────────────────────┘
           ↓ For individual lookups
┌─────────────────────────────────────┐
│  LRU In-Memory Cache                │ ← Only hot memories
│  Max size: 1000-5000 items          │
│  Evicts least recently used         │
└─────────────────────────────────────┘
```

**Benefits:**
- ✅ Fast repeated queries (Redis)
- ✅ Efficient memory usage (LRU with size limit)
- ✅ No cold cache problem

**Code Changes:**
```typescript
// Add LRU cache for individual memories
import { LRUCache } from 'lru-cache';

private memoryCache = new LRUCache<string, Memory>({
  max: 5000, // Max 5000 hot memories
  ttl: 1000 * 60 * 15, // 15 minutes
});

async getMemory(uuid: string): Promise<Memory | null> {
  // 1. Check LRU cache
  const cached = this.memoryCache.get(uuid);
  if (cached) return cached;
  
  // 2. Fetch from Qdrant
  const memory = await this.fetchFromQdrant(uuid);
  if (memory) {
    this.memoryCache.set(uuid, memory);
  }
  return memory;
}
```

### Phase 4: Performance Optimizations (Low Priority)

**Goal**: Further optimize for scale

**Optimizations:**
1. **Batch Embedding**: Generate embeddings in batches for multiple queries
2. **Async Prefetching**: Prefetch likely-needed memories
3. **Connection Pooling**: Optimize Qdrant connection reuse
4. **Query Result Streaming**: Stream large result sets
5. **Index Optimization**: Ensure Qdrant indexes are optimized

## Migration Strategy

### Step 1: Implement Vector Search (Week 1)
- [ ] Refactor `searchMemories()` to use vector search
- [ ] Remove `ensureCache()` dependency
- [ ] Add feature flag: `USE_VECTOR_SEARCH=true`
- [ ] Test with existing queries
- [ ] Compare performance metrics

### Step 2: Add Hybrid Search (Week 2)
- [ ] Implement keyword fallback
- [ ] Add result merging logic
- [ ] Test recall improvements
- [ ] Monitor query performance

### Step 3: Implement Smart Caching (Week 3)
- [ ] Add LRU cache for individual memories
- [ ] Enhance Redis cache strategy
- [ ] Add cache metrics
- [ ] Test cache hit rates

### Step 4: Performance Tuning (Week 4)
- [ ] Optimize embedding generation
- [ ] Tune Qdrant search parameters
- [ ] Add performance monitoring
- [ ] Load testing with large datasets

## Success Metrics

### Performance
- **First Query Latency**: < 500ms (vs current 5-30s)
- **Memory Usage**: < 100MB (vs current 100MB-1GB+)
- **Query Throughput**: > 100 queries/sec (vs current ~10-20)
- **Cache Hit Rate**: > 80% for repeated queries

### Scalability
- **Collection Size**: Support 1M+ memories
- **Concurrent Queries**: Handle 100+ concurrent searches
- **Memory Growth**: Linear with hot cache size, not collection size

## Risk Mitigation

1. **Backward Compatibility**: Keep old code path behind feature flag
2. **Gradual Rollout**: Enable for 10% → 50% → 100% of queries
3. **Monitoring**: Add detailed metrics for both approaches
4. **Rollback Plan**: Quick revert if issues detected
5. **Testing**: Comprehensive integration tests with large datasets

## Dependencies

- ✅ `embeddingService` - Already exists
- ✅ `QdrantService.searchMemory()` - Already exists
- ✅ `redisCacheService` - Already exists
- ⚠️ `lru-cache` package - Already in lock file (transitive), may need explicit: `npm install lru-cache`
- ⚠️ Qdrant collection must have vector index configured

## Additional Considerations

### Integration with Existing Systems

1. **Duplicate Prevention**: The new similarity check in `checkSimilarMemoryByTitle()` also uses `searchMemories()`, so it will benefit from vector search improvements
2. **Redis Cache**: Already caching search results - keep this layer for repeated queries
3. **Semantic Search Service**: `SemanticSearchCore` already uses `QdrantService.searchMemory()` - can share patterns
4. **Metrics**: Add metrics for:
   - Vector search latency
   - Cache hit/miss rates
   - Memory usage (LRU cache size)
   - Query throughput

### Backward Compatibility

- Keep `ensureCache()` method but mark as deprecated
- Add feature flag: `KAIROS_USE_VECTOR_SEARCH=true` (default: false initially)
- Gradual migration: Start with new code path, fallback to old if needed
- Monitor both approaches during transition

### Testing Strategy

1. **Unit Tests**: Test vector search integration
2. **Integration Tests**: Test with real Qdrant collection
3. **Performance Tests**: Compare old vs new approach with large datasets
4. **Load Tests**: Test concurrent query handling
5. **Memory Tests**: Verify memory usage stays bounded

### Rollout Plan

1. **Week 1**: Implement behind feature flag, test in dev
2. **Week 2**: Enable for 10% of queries, monitor metrics
3. **Week 3**: Enable for 50% of queries, compare performance
4. **Week 4**: Full rollout, remove old code path

## Notes

- Current `scoreMemory()` function can be kept for result refinement (applied to top-N vector results)
- Redis cache for search results should remain (already working well)
- Individual memory lookups (`getMemory()`) can keep current approach with LRU enhancement
- Consider Qdrant's hybrid search API when available (combines vector + keyword natively)
- The `QdrantService.searchMemory()` already exists and works - leverage it instead of reinventing
