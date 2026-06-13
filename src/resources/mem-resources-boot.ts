import { MemoryQdrantStore } from '../services/memory/store.js';
import { structuredLogger } from '../utils/structured-logger.js';
import { qdrantService } from '../services/qdrant/index.js';
import { runWithSpaceContextAsync } from '../utils/tenant-context.js';
import { KAIROS_APP_SPACE_ID } from '../config.js';
import { MEM_FILE_UUID_KEY, getMemDir, getMemDirFallback, readMemFiles } from './mem-dir-utils.js';
import { deletePreexistingAppSpaceEntries, extractFrontmatterSlug, remapMemoryToTargetUuid } from './mem-uuid-mapper.js';
import { assertSystemProtocolStaticUuids } from './mem-injection-assertions.js';
import { parseFrontmatter } from '../utils/frontmatter.js';
import { compareSemver } from '../utils/version-compare.js';

export async function injectMemResourcesAtBoot(memoryStore: MemoryQdrantStore, options: { force?: boolean } = {}): Promise<void> {
  const primaryDir = getMemDir();
  structuredLogger.info(`[mem-resources-boot] Mem dir: ${primaryDir}`);

  let memResources = await readMemFiles(primaryDir);
  if (Object.keys(memResources).length === 0) {
    const fallbackDir = getMemDirFallback();
    structuredLogger.info(`[mem-resources-boot] No files in primary dir, trying fallback: ${fallbackDir}`);
    memResources = await readMemFiles(fallbackDir);
  }

  const fileCount = Object.keys(memResources).length;
  structuredLogger.info(`[mem-resources-boot] Mem files found: ${fileCount}`);

  if (fileCount === 0) {
    structuredLogger.info('[mem-resources-boot] No mem resources to inject');
    return;
  }

  const appSpaceContext = {
    userId: '',
    groupIds: [],
    allowedSpaceIds: [KAIROS_APP_SPACE_ID],
    defaultWriteSpaceId: KAIROS_APP_SPACE_ID,
    personalSpaceId: ''
  };

  await runWithSpaceContextAsync(appSpaceContext, async () => {
    structuredLogger.info(`[mem-resources-boot] Injecting ${fileCount} mem resources into Qdrant (force: ${options.force || false})`);

    const llmModelId = 'system-boot';
    let injectedCount = 0;
    const { client, collection } = memoryStore.getQdrantAccess();
    const shippedUuids = new Set<string>();

    for (const [key, markdownContent] of Object.entries(memResources)) {
      if (typeof markdownContent !== 'string') continue;
      if (!MEM_FILE_UUID_KEY.test(key)) {
        structuredLogger.debug(`[mem-resources-boot] Skip non-UUID mem key: ${key}`);
        continue;
      }

      const targetUuid = key;
      shippedUuids.add(targetUuid);
      const slug = extractFrontmatterSlug(markdownContent);
      const shippedVersion = parseFrontmatter(markdownContent).version ?? undefined;

      try {
        if (options.force) {
          // Force mode: delete existing and re-inject
          try {
            if (slug) {
              await client.delete(collection, {
                filter: {
                  must: [
                    { key: 'space_id', match: { value: KAIROS_APP_SPACE_ID } },
                    { key: 'slug', match: { value: slug } }
                  ]
                }
              } as any);
            }
            await client.delete(collection, { points: [targetUuid] } as any);
            structuredLogger.info(`[mem-resources-boot] Deleted existing memory ${targetUuid} (force mode)`);
          } catch {
          }
        } else {
          // Non-force mode: version-based upsert
          try {
            const existing = await qdrantService.getMemoryByUUID(targetUuid);
            if (existing) {
              const storedVersion = typeof (existing as any).protocol_version === 'string'
                ? (existing as any).protocol_version
                : undefined;
              const cmp = compareSemver(shippedVersion, storedVersion);
              if (cmp <= 0) {
                structuredLogger.info(
                  `[mem-resources-boot] Memory ${targetUuid} version ${storedVersion ?? 'none'} >= shipped ${shippedVersion ?? 'none'}, skipping`
                );
                continue;
              }
              structuredLogger.info(
                `[mem-resources-boot] Memory ${targetUuid} shipped ${shippedVersion ?? 'none'} > stored ${storedVersion ?? 'none'}, updating`
              );
              // Fall through to store with forceUpdate
            }
          } catch {
            // UUID lookup failed — treat as new entry
          }
        }

        await deletePreexistingAppSpaceEntries(memoryStore, markdownContent, targetUuid);
        const storeOpts: { forceUpdate: boolean; protocolVersion?: string } = { forceUpdate: true };
        if (shippedVersion) storeOpts.protocolVersion = shippedVersion;
        const memories = await memoryStore.storeAdapter([markdownContent], llmModelId, storeOpts);

        if (memories.length > 0) {
          const storedMemory = memories[0]!;
          if (storedMemory.memory_uuid !== targetUuid) {
            await remapMemoryToTargetUuid(memoryStore, storedMemory.memory_uuid, targetUuid);
          }
          injectedCount++;
          structuredLogger.info(`[mem-resources-boot] Injected memory ${targetUuid}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        structuredLogger.error(`[mem-resources-boot] Failed to inject memory ${targetUuid}: ${message}`);
      }
    }

    structuredLogger.info(`[mem-resources-boot] Successfully injected ${injectedCount} mem resources into Qdrant`);

    // Part B — Prune orphans: delete app-space adapters no longer shipped
    try {
      const shippedCount = shippedUuids.size;
      let prunedCount = 0;
      let scrollOffset: any = undefined;
      const storedUuids: string[] = [];

      // Scroll all points in app space to find orphans
      do {
        const page = await client.scroll(collection, {
          limit: 100,
          offset: scrollOffset,
          with_payload: { include: ['space_id'] },
          with_vector: false,
          filter: {
            must: [
              { key: 'space_id', match: { value: KAIROS_APP_SPACE_ID } }
            ]
          }
        } as any);

        const points = page?.points ?? [];
        for (const point of points) {
          const pointId = typeof point.id === 'string' ? point.id : String(point.id);
          if (!shippedUuids.has(pointId)) {
            storedUuids.push(pointId);
          }
        }

        scrollOffset = page?.next_page_offset ?? undefined;
      } while (scrollOffset !== undefined);

      if (storedUuids.length > 0) {
        // Delete in batches
        const batchSize = 100;
        for (let i = 0; i < storedUuids.length; i += batchSize) {
          const batch = storedUuids.slice(i, i + batchSize);
          await client.delete(collection, { points: batch } as any);
          prunedCount += batch.length;
        }
        structuredLogger.warn(
          `[mem-resources-boot] Pruned ${prunedCount} orphaned app-space adapter(s) (shipped: ${shippedCount})`
        );

        const { redisCacheService } = await import('../services/redis-cache.js');
        await redisCacheService.invalidateAfterUpdate();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      structuredLogger.error(`[mem-resources-boot] Failed to prune orphaned adapters: ${message}`);
    }

    await assertSystemProtocolStaticUuids(memoryStore);
    structuredLogger.info('[mem-resources-boot] Verified static UUID invariant for bundled system protocols');

    const { methods } = (memoryStore as any);
    if (methods && typeof methods.invalidateLocalCache === 'function') {
      methods.invalidateLocalCache();
    }
  });
}
