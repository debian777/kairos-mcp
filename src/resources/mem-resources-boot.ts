import { MemoryQdrantStore } from '../services/memory/store.js';
import { structuredLogger } from '../utils/structured-logger.js';
import { qdrantService } from '../services/qdrant/index.js';
import { runWithSpaceContextAsync } from '../utils/tenant-context.js';
import { KAIROS_APP_SPACE_ID } from '../config.js';
import { readdir, readFile } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { parseFrontmatter } from '../utils/frontmatter.js';
import { IDGenerator } from '../services/id-generator.js';

/** Mem markdown whose basename (no .md) is a UUID — inject as a layer-row URI (`kairos://layer/{uuid}`). */
const MEM_FILE_UUID_KEY =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SYSTEM_PROTOCOL_UUID_BY_SLUG: Record<string, string> = {
  'create-new-protocol': '00000000-0000-0000-0000-000000002001',
  'refine-search': '00000000-0000-0000-0000-000000002002',
  'create-new-protocol-review': '00000000-0000-0000-0000-000000002003',
  'challenge-type-guide': '00000000-0000-0000-0000-000000002004',
  'phase-critic': '00000000-0000-0000-0000-000000002005',
  'protocol-linking-guide': '00000000-0000-0000-0000-000000002006'
};

function extractFirstH1Title(markdown: string): string | null {
  const lines = markdown.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^#\s+(.+)$/);
    if (m && m[1]) {
      const title = m[1].trim();
      return title.length > 0 ? title : null;
    }
  }
  return null;
}

async function deletePreexistingAppSpaceEntries(
  memoryStore: MemoryQdrantStore,
  markdownContent: string,
  targetUuid: string
): Promise<void> {
  const parsed = parseFrontmatter(markdownContent);
  const body = parsed.body.length > 0 ? parsed.body : markdownContent;
  const slug = typeof parsed.slugRaw === 'string' ? parsed.slugRaw.trim() : '';
  const h1Title = extractFirstH1Title(body);

  const filters: any[] = [];
  if (slug.length > 0) {
    filters.push({
      must: [
        { key: 'slug', match: { value: slug } },
        { key: 'space_id', match: { value: KAIROS_APP_SPACE_ID } }
      ]
    });
  }
  if (h1Title) {
    const adapterId = IDGenerator.generateAdapterUUIDv5(h1Title);
    filters.push({
      must: [
        { key: 'adapter.id', match: { value: adapterId } },
        { key: 'space_id', match: { value: KAIROS_APP_SPACE_ID } }
      ]
    });
  }

  if (filters.length === 0) {
    return;
  }

  const { client, collection } = memoryStore.getQdrantAccess();

  const { redisCacheService } = await import('../services/redis-cache.js');
  await redisCacheService.invalidateMemoryCache(targetUuid);

  for (const filter of filters) {
    await client.delete(collection, { filter } as any);
  }
  await redisCacheService.invalidateAfterUpdate();

  if (slug.length > 0) {
    structuredLogger.warn(
      `[mem-resources-boot] Removed preexisting app-space points for slug=${slug}; preparing canonical UUID=${targetUuid}`
    );
  } else {
    structuredLogger.warn(
      `[mem-resources-boot] Removed preexisting app-space points; preparing canonical UUID=${targetUuid}`
    );
  }
}

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

async function assertSystemProtocolStaticUuids(memoryStore: MemoryQdrantStore): Promise<void> {
  const { client, collection } = memoryStore.getQdrantAccess();
  const missing: string[] = [];
  const mismatched: string[] = [];

  for (const [slug, uuid] of Object.entries(SYSTEM_PROTOCOL_UUID_BY_SLUG)) {
    const retrieved = await client.retrieve(collection, {
      ids: [uuid],
      with_payload: true,
      with_vector: false
    });
    const point = retrieved?.[0];
    if (!point) {
      missing.push(`${slug} -> ${uuid}`);
      continue;
    }

    const payload = (point.payload ?? {}) as Record<string, unknown>;
    const pointSlug = typeof payload['slug'] === 'string' ? payload['slug'] : null;
    const pointSpaceId = typeof payload['space_id'] === 'string' ? payload['space_id'] : null;
    if (pointSlug !== slug || pointSpaceId !== KAIROS_APP_SPACE_ID) {
      mismatched.push(
        `${uuid} expected(slug=${slug},space=${KAIROS_APP_SPACE_ID}) actual(slug=${pointSlug ?? 'null'},space=${pointSpaceId ?? 'null'})`
      );
    }
  }

  if (missing.length > 0 || mismatched.length > 0) {
    throw new Error(
      `[mem-resources-boot] Static system protocol invariant failed. ` +
      `missing=[${missing.join('; ')}] mismatched=[${mismatched.join('; ')}]`
    );
  }
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
    defaultWriteSpaceId: KAIROS_APP_SPACE_ID,
    personalSpaceId: ''
  };

  await runWithSpaceContextAsync(appSpaceContext, async () => {
    structuredLogger.info(`[mem-resources-boot] Injecting ${fileCount} mem resources into Qdrant (force: ${options.force || false})`);

    const llmModelId = 'system-boot';
    let injectedCount = 0;

    for (const [key, markdownContent] of Object.entries(memResources)) {
      if (typeof markdownContent !== 'string') continue;
      if (!MEM_FILE_UUID_KEY.test(key)) {
        structuredLogger.debug(`[mem-resources-boot] Skip non-UUID mem key: ${key}`);
        continue;
      }

      const targetUuid = key; // Use key (filename) as UUID

      try {
      // Use storeChain to handle parsing, embeddings, and force update logic.
      // Always forceUpdate on storeChain so a prior boot (e.g. old step-1 UUID before filename change)
      // does not leave a same-label adapter that blocks training the canonical file UUID (DUPLICATE_ADAPTER / DUPLICATE_SLUG).
      // Per-file skip when target UUID already exists (below) still avoids re-embedding on normal restarts.
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

        await deletePreexistingAppSpaceEntries(memoryStore, markdownContent, targetUuid);
        const memories = await memoryStore.storeAdapter([markdownContent], llmModelId, { forceUpdate: false });

        if (memories.length > 0) {
          // Only the first step is remapped to the file UUID; other layers of the same adapter keep server-generated IDs.
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
              await redisCacheService.invalidateAfterUpdate();
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

    await assertSystemProtocolStaticUuids(memoryStore);
    structuredLogger.info('[mem-resources-boot] Verified static UUID invariant for bundled system protocols');

    const { methods } = (memoryStore as any);
    if (methods && typeof methods.invalidateLocalCache === 'function') {
      methods.invalidateLocalCache();
    }
  });
}
