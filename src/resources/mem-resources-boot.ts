import { MemoryQdrantStore } from '../services/memory/store.js';
import { structuredLogger } from '../utils/structured-logger.js';
import { qdrantService } from '../services/qdrant/index.js';
import { runWithSpaceContextAsync } from '../utils/tenant-context.js';
import { KAIROS_APP_SPACE_ID } from '../config.js';
import { readdir, readFile } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

/**
 * Get the directory containing mem files at runtime
 * Works in both development (src/) and production (dist/)
 */
function getMemDir(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  // In dist/, this will be dist/resources/mem-resources-boot.js
  // So we need to go up to dist/ and then to embed-docs/mem/
  // In development (when running from src/), this would be src/resources/mem-resources-boot.ts
  // But in production, files are in dist/embed-docs/mem/
  const baseDir = join(__dirname, '..', 'embed-docs', 'mem');
  return baseDir;
}

/**
 * Return the other of src/embed-docs/mem or dist/embed-docs/mem for fallback when primary has 0 files.
 */
function getMemDirFallback(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const parentDir = join(__dirname, '..');
  const otherName = basename(parentDir) === 'src' ? 'dist' : 'src';
  return join(parentDir, '..', otherName, 'embed-docs', 'mem');
}

/**
 * Read mem files from filesystem at runtime
 * Returns a map of filename (without .md) -> content
 * If memDir yields 0 .md files, tries fallback path (other of src/dist).
 */
async function readMemFiles(memDir?: string): Promise<Record<string, string>> {
  const dir = memDir ?? getMemDir();
  const memResources: Record<string, string> = {};

  try {
    const files = await readdir(dir);
    const mdFiles = files.filter(f => f.endsWith('.md'));

    for (const file of mdFiles) {
      const filePath = join(dir, file);
      const key = file.replace(/\.md$/, ''); // Remove .md extension
      const content = await readFile(filePath, 'utf-8');
      memResources[key] = content;
      structuredLogger.debug(`[mem-resources-boot] Loaded mem file: ${file} -> ${key}`);
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      structuredLogger.warn(`[mem-resources-boot] Mem directory not found: ${dir} (this is OK if no mem files exist)`);
    } else {
      structuredLogger.error(`[mem-resources-boot] Failed to read mem directory ${dir}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return memResources;
}

/**
 * Inject mem resources from filesystem into Qdrant at system boot
 * Uses the key (filename) as the UUID and supports force option for override
 * Uses storeChain for processing but updates UUID to match filename
 */
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
    defaultWriteSpaceId: KAIROS_APP_SPACE_ID
  };

  await runWithSpaceContextAsync(appSpaceContext, async () => {
    structuredLogger.info(`[mem-resources-boot] Injecting ${fileCount} mem resources into Qdrant (force: ${options.force || false})`);

    const llmModelId = 'system-boot';
    let injectedCount = 0;

    for (const [key, markdownContent] of Object.entries(memResources)) {
      if (typeof markdownContent !== 'string') continue;

      const targetUuid = key; // Use key (filename) as UUID

      try {
      // Use storeChain to handle parsing, embeddings, and force update logic
      // storeChain handles forceUpdate by deleting existing chains, but we need to handle individual UUIDs
        if (options.force) {
          try {
            await qdrantService.deleteMemory(targetUuid);
            structuredLogger.info(`[mem-resources-boot] Deleted existing memory ${targetUuid} (force mode)`);
          } catch {
            // Ignore errors if memory doesn't exist
          }
        } else {
          try {
            const existing = await qdrantService.getMemoryByUUID(targetUuid);
            if (existing) {
              structuredLogger.info(`[mem-resources-boot] Memory ${targetUuid} already exists, skipping (use --force flag to override)`);
              continue;
            }
          } catch {
            // Continue if check fails
          }
        }

        const memories = await memoryStore.storeChain([markdownContent], llmModelId, { forceUpdate: options.force || false });

        if (memories.length > 0) {
          // Only the first step is remapped to the file UUID; other steps of the same chain keep server-generated IDs.
          const storedMemory = memories[0]!;
          if (storedMemory.memory_uuid !== targetUuid) {
            const { client, collection } = memoryStore.getQdrantAccess();
            const storedPoint = await client.retrieve(collection, {
              ids: [storedMemory.memory_uuid],
              with_payload: true,
              with_vector: true
            });

            if (storedPoint && storedPoint.length > 0) {
              const point = storedPoint[0]!;
              await client.delete(collection, { points: [storedMemory.memory_uuid] });
              const upsertPoint: any = {
                id: targetUuid,
                payload: point.payload
              };
              if (point.vector) {
                upsertPoint.vector = point.vector;
              }
              await client.upsert(collection, { points: [upsertPoint] });
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
        const message = err instanceof Error ? err.message : String(err);
        structuredLogger.error(`[mem-resources-boot] Failed to inject memory ${targetUuid}: ${message}`);
        structuredLogger.info(`[mem-resources-boot] Failed memory ${targetUuid}`);
      }
    }

    structuredLogger.info(`[mem-resources-boot] Successfully injected ${injectedCount} mem resources into Qdrant`);

    const { methods } = (memoryStore as any);
    if (methods && typeof methods.invalidateLocalCache === 'function') {
      methods.invalidateLocalCache();
    }
  });
}

