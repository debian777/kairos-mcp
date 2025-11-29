import { MemoryQdrantStore } from '../services/memory/store.js';
import { getMem } from './embedded-mcp-resources.js';
import { structuredLogger } from '../utils/structured-logger.js';
import { qdrantService } from '../services/qdrant/index.js';

/**
 * Inject mem resources from embedded-mcp-resources into Qdrant at system boot
 * Uses the key (filename) as the UUID and supports force option for override
 * Uses storeChain for processing but updates UUID to match filename
 */
export async function injectMemResourcesAtBoot(memoryStore: MemoryQdrantStore, options: { force?: boolean } = {}): Promise<void> {
  const memResources = getMem();
  
  if (Object.keys(memResources).length === 0) {
    structuredLogger.info('[mem-resources-boot] No mem resources to inject');
    return;
  }

  structuredLogger.info(`[mem-resources-boot] Injecting ${Object.keys(memResources).length} mem resources into Qdrant (force: ${options.force || false})`);

  const llmModelId = 'system-boot';
  let injectedCount = 0;

  for (const [key, markdownContent] of Object.entries(memResources)) {
    if (typeof markdownContent !== 'string') continue;

    const targetUuid = key; // Use key (filename) as UUID
    
    try {
      // Use storeChain to handle parsing, embeddings, and force update logic
      // storeChain handles forceUpdate by deleting existing chains, but we need to handle individual UUIDs
      if (options.force) {
        // Delete existing memory with target UUID if present (cache invalidation handled by deleteMemory)
        try {
          await qdrantService.deleteMemory(targetUuid);
          structuredLogger.info(`[mem-resources-boot] Deleted existing memory ${targetUuid} (force mode)`);
        } catch {
          // Ignore errors if memory doesn't exist
        }
      } else {
        // Check if memory already exists
        try {
          const existing = await qdrantService.getMemoryByUUID(targetUuid);
          if (existing) {
            structuredLogger.info(`[mem-resources-boot] Memory ${targetUuid} already exists, skipping (use force=true to override)`);
            continue;
          }
        } catch {
          // Continue if check fails
        }
      }

      // Store using storeChain (handles parsing, embeddings, cache invalidation)
      const memories = await memoryStore.storeChain([markdownContent], llmModelId, { forceUpdate: options.force || false });
      
      if (memories.length > 0) {
        // Update UUID to match filename if different
        const storedMemory = memories[0]!;
        if (storedMemory.memory_uuid !== targetUuid) {
          // Get the stored point and update its ID
          const { client, collection } = memoryStore.getQdrantAccess();
          const storedPoint = await client.retrieve(collection, {
            ids: [storedMemory.memory_uuid],
            with_payload: true,
            with_vector: true
          });
          
          if (storedPoint && storedPoint.length > 0) {
            const point = storedPoint[0]!;
            // Delete old point and create new one with target UUID
            await client.delete(collection, { points: [storedMemory.memory_uuid] });
            const upsertPoint: any = {
              id: targetUuid,
              payload: point.payload
            };
            if (point.vector) {
              upsertPoint.vector = point.vector;
            }
            await client.upsert(collection, { points: [upsertPoint] });
            // Invalidate cache for both UUIDs
            const { redisCacheService } = await import('../services/redis-cache.js');
            await redisCacheService.invalidateMemoryCache(storedMemory.memory_uuid);
            await redisCacheService.invalidateMemoryCache(targetUuid);
            await redisCacheService.invalidateSearchCache();
          }
        }
        injectedCount++;
        structuredLogger.info(`[mem-resources-boot] Injected memory ${targetUuid}`);
      }
    } catch (err) {
      structuredLogger.error(`[mem-resources-boot] Failed to inject memory ${targetUuid}: ${err instanceof Error ? err.message : String(err)}`);
      // Continue with other memories
    }
  }

  structuredLogger.info(`[mem-resources-boot] Successfully injected ${injectedCount} mem resources into Qdrant`);
  
  // Invalidate local in-process cache
  const { methods } = (memoryStore as any);
  if (methods && typeof methods.invalidateLocalCache === 'function') {
    methods.invalidateLocalCache();
  }
}

