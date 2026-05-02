/**
 * Shared skill export item assembly for skill_tree / skill_zip (and HTTP binary ZIP).
 */

import type { MemoryQdrantStore } from '../services/memory/store.js';
import type { QdrantService } from '../services/qdrant/service.js';
import { assembleSkillExportItem } from './skill-export/assemble-skill-item.js';
import { resolveExportAdapter } from './export-resolve-adapter.js';
import { dedupeSlug, rehomeItemFiles } from './export-selection.js';
import { loadArtifactFilesForAdapter } from './skill-export/artifact-files.js';
import { appendSha256SumsToSkillExportItem } from './skill-export/sha256sums.js';
import type { SkillExportItem } from './skill-export/types.js';

/**
 * Build merged skill items (SKILL.md + artifacts + diagnostics) for each resolved adapter URI.
 */
export async function collectSkillExportItemsForZip(
  memoryStore: MemoryQdrantStore,
  qdrantService: QdrantService | undefined,
  adapterUris: string[]
): Promise<{ items: SkillExportItem[]; primaryUri: string }> {
  if (adapterUris.length === 0) {
    throw new Error('No adapters matched this export (empty space or selection).');
  }
  const usedSlugs = new Set<string>();
  const items: SkillExportItem[] = [];

  for (const uri of adapterUris) {
    const { adapterId, layerId } = await resolveExportAdapter(memoryStore, qdrantService, uri);
    let item = await assembleSkillExportItem({
      memoryStore,
      qdrantService,
      layerId,
      requestUri: uri,
      adapterId
    });
    const unique = dedupeSlug(item.slug, usedSlugs);
    if (unique !== item.slug) {
      item = rehomeItemFiles(item, unique);
    }
    const { files: extras, diagnostics: artifactDiagnostics } = await loadArtifactFilesForAdapter(
      memoryStore,
      adapterId
    );
    item = {
      ...item,
      files: [...item.files, ...extras],
      diagnostics: [...item.diagnostics, ...artifactDiagnostics]
    };
    item = appendSha256SumsToSkillExportItem(item);
    items.push(item);
  }

  return { items, primaryUri: adapterUris[0]! };
}
