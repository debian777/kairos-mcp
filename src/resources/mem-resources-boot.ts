import { MemoryQdrantStore } from '../services/memory/store.js';
import { structuredLogger } from '../utils/structured-logger.js';
import { qdrantService } from '../services/qdrant/index.js';
import { runWithSpaceContextAsync } from '../utils/tenant-context.js';
import { KAIROS_APP_SPACE_ID } from '../config.js';
import { MEM_FILE_UUID_KEY, getMemDir, getMemDirFallback, readMemFiles } from './mem-dir-utils.js';
import { deletePreexistingAppSpaceEntries, extractFrontmatterSlug, remapMemoryToTargetUuid } from './mem-uuid-mapper.js';
import { assertSystemProtocolStaticUuids } from './mem-injection-assertions.js';

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

    for (const [key, markdownContent] of Object.entries(memResources)) {
      if (typeof markdownContent !== 'string') continue;
      if (!MEM_FILE_UUID_KEY.test(key)) {
        structuredLogger.debug(`[mem-resources-boot] Skip non-UUID mem key: ${key}`);
        continue;
      }

      const targetUuid = key;
      const slug = extractFrontmatterSlug(markdownContent);

      try {
        if (options.force) {
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
          try {
            const existing = await qdrantService.getMemoryByUUID(targetUuid);
            if (existing) {
              structuredLogger.info(`[mem-resources-boot] Memory ${targetUuid} already exists, skipping`);
              continue;
            }
          } catch {
          }
          if (slug) {
            try {
              const page = await client.scroll(collection, {
                limit: 1,
                with_payload: false,
                with_vector: false,
                filter: {
                  must: [
                    { key: 'space_id', match: { value: KAIROS_APP_SPACE_ID } },
                    { key: 'slug', match: { value: slug } }
                  ]
                }
              } as any);
              const points = page?.points ?? [];
              if (points.length > 0) {
                await client.delete(collection, {
                  filter: {
                    must: [
                      { key: 'space_id', match: { value: KAIROS_APP_SPACE_ID } },
                      { key: 'slug', match: { value: slug } }
                    ]
                  }
                } as any);
                structuredLogger.warn(`[mem-resources-boot] Removed existing app-space points for slug=${slug}`);
              }
            } catch {
            }
          }
        }

        await deletePreexistingAppSpaceEntries(memoryStore, markdownContent, targetUuid);
        const memories = await memoryStore.storeAdapter([markdownContent], llmModelId, { forceUpdate: false });

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

    await assertSystemProtocolStaticUuids(memoryStore);
    structuredLogger.info('[mem-resources-boot] Verified static UUID invariant for bundled system protocols');

    const { methods } = (memoryStore as any);
    if (methods && typeof methods.invalidateLocalCache === 'function') {
      methods.invalidateLocalCache();
    }
  });
}