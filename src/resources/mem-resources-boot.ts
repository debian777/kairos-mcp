import { MemoryQdrantStore } from '../services/memory/store.js';
import { structuredLogger } from '../utils/structured-logger.js';
import { runWithSpaceContextAsync } from '../utils/tenant-context.js';
import { KAIROS_APP_SPACE_ID } from '../config.js';
import { MEM_FILE_SLUG_KEY, getMemDir, getMemDirFallback, readMemFiles } from './mem-dir-utils.js';
import { deletePreexistingAppSpaceEntries, extractFrontmatterSlug } from './mem-uuid-mapper.js';
import { sha256Hex } from '../tools/skill-export/sha256.js';
import { parseFrontmatter } from '../utils/frontmatter.js';

/** Payload key for storing content SHA256 (enables change detection at boot). */
const CONTENT_SHA256_KEY = 'content_sha256';

/**
 * Inject mem resources from filesystem into Qdrant at system boot.
 * Uses slug-based filenames. Each adapter file is deleted-then-retrained
 * to ensure clean state. SHA256 hashes are stored in payload for future
 * change detection use.
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
    const { client, collection } = memoryStore.getQdrantAccess();
    let injectedCount = 0;

    for (const [slug, markdownContent] of Object.entries(memResources)) {
      if (typeof markdownContent !== 'string') continue;
      if (!MEM_FILE_SLUG_KEY.test(slug)) {
        structuredLogger.debug(`[mem-resources-boot] Skip non-slug mem key: ${slug}`);
        continue;
      }

      const frontmatterSlug = extractFrontmatterSlug(markdownContent);
      if (frontmatterSlug && frontmatterSlug !== slug) {
        structuredLogger.warn(
          `[mem-resources-boot] Filename slug '${slug}' differs from frontmatter slug '${frontmatterSlug}'; using filename`
        );
      }

      const shippedSha = sha256Hex(markdownContent);

      try {
        // Delete any preexisting entries by slug/title filter
        await deletePreexistingAppSpaceEntries(memoryStore, markdownContent, slug);

        // Train the adapter
        const storedVersions = parseFrontmatter(markdownContent).version ?? undefined;
        const storeOpts: { forceUpdate: boolean; protocolVersion?: string } = { forceUpdate: true };
        if (storedVersions) storeOpts.protocolVersion = storedVersions;
        const memories = await memoryStore.storeAdapter([markdownContent], llmModelId, storeOpts);

        // Store content_sha256 in all layers for future change detection
        if (memories.length > 0) {
          const layerIds = memories.map(m => m.memory_uuid);
          await client.setPayload(collection, {
            payload: { [CONTENT_SHA256_KEY]: shippedSha },
            points: layerIds
          } as any);
          injectedCount++;
          structuredLogger.info(
            `[mem-resources-boot] Trained adapter '${slug}' (${memories.length} layer(s), SHA=${shippedSha.slice(0, 12)}...)`
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        structuredLogger.error(`[mem-resources-boot] Failed to inject adapter '${slug}': ${message}`);
      }
    }

    structuredLogger.info(
      `[mem-resources-boot] Boot injection complete: ${injectedCount} adapter(s) trained out of ${fileCount} file(s)`
    );

    const { methods } = (memoryStore as any);
    if (methods && typeof methods.invalidateLocalCache === 'function') {
      methods.invalidateLocalCache();
    }
  });
}
