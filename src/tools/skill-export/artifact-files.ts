/**
 * Load attached artifact memories for an adapter into skill export file list.
 */

import type { MemoryQdrantStore } from '../../services/memory/store.js';
import {
  createDefaultArtifactSanitizationRules,
  runArtifactSanitization,
  type ArtifactSanitizationRule
} from './artifact-sanitization/index.js';
import type { SkillExportDiagnostic, SkillExportFile } from './types.js';
import { normalizeArtifactRelativePath } from '../artifact-relative-path.js';
import { sha256Hex } from './sha256.js';

const SHA256_HEX_RE = /^[a-f0-9]{64}$/i;

function isValidStoredArtifactSha256(value: unknown): value is string {
  return typeof value === 'string' && SHA256_HEX_RE.test(value);
}

const ALLOWED_ARTIFACT_MIMES = [
  'text/x-python',
  'text/x-shellscript',
  'text/javascript',
  'text/x-perl',
  'text/x-toml',
  'text/yaml',
  'text/plain'
] as const;

export interface LoadArtifactFilesOptions {
  /** Override default rules; omit to use {@link createDefaultArtifactSanitizationRules}. */
  sanitizationRules?: readonly ArtifactSanitizationRule[];
}

/**
 * Return files under `artifacts/` relative paths for ZIP layout, plus sanitization diagnostics.
 */
export async function loadArtifactFilesForAdapter(
  memoryStore: MemoryQdrantStore,
  adapterId: string,
  options?: LoadArtifactFilesOptions
): Promise<{ files: SkillExportFile[]; diagnostics: SkillExportDiagnostic[] }> {
  const rules = options?.sanitizationRules ?? createDefaultArtifactSanitizationRules();
  const { client, collection } = memoryStore.getQdrantAccess();
  const out: SkillExportFile[] = [];
  const diagnostics: SkillExportDiagnostic[] = [];
  let offset: string | number | undefined;
  do {
    const page = await client.scroll(collection, {
      filter: {
        must: [
          { key: 'adapter.id', match: { value: adapterId } },
          { key: 'content_type', match: { any: [...ALLOWED_ARTIFACT_MIMES] } }
        ]
      },
      limit: 256,
      ...(offset !== undefined ? { offset } : {}),
      with_payload: true,
      with_vector: false
    });
    const points = Array.isArray(page?.points) ? page.points : [];
    for (const point of points) {
      const payload = (point?.payload ?? {}) as Record<string, unknown>;
      const artifactPayload = (payload['artifact'] ?? {}) as Record<string, unknown>;
      const name =
        typeof artifactPayload['name'] === 'string' && artifactPayload['name'].trim().length > 0
          ? artifactPayload['name'].trim()
          : 'artifact';
      const text = typeof payload['text'] === 'string' ? payload['text'] : '';
      const ct = typeof payload['content_type'] === 'string' ? payload['content_type'] : 'text/plain';
      const safeName = name.replace(/[/\\]/g, '_');
      const storedRel =
        typeof artifactPayload['relative_path'] === 'string' ? artifactPayload['relative_path'].trim() : '';
      const normalizedStored = storedRel.length > 0 ? normalizeArtifactRelativePath(storedRel) : null;
      let rel: string;
      if (normalizedStored) {
        rel = normalizedStored;
      } else {
        if (storedRel.length > 0) {
          diagnostics.push({
            severity: 'warning',
            code: 'artifact_relative_path_invalid',
            message:
              `Ignoring invalid artifact.relative_path for "${name}"; falling back to artifacts/${safeName}.`
          });
        }
        rel = `artifacts/${safeName}`;
      }
      diagnostics.push(
        ...runArtifactSanitization({ relativePath: rel, declaredContentType: ct }, rules)
      );
      const computedHex = sha256Hex(text);
      const stored = artifactPayload['sha256'];
      let fileSha = computedHex;
      if (isValidStoredArtifactSha256(stored)) {
        const normalized = stored.toLowerCase();
        if (normalized !== computedHex) {
          diagnostics.push({
            severity: 'warning',
            code: 'artifact_stored_sha_mismatch',
            message: `Stored artifact.sha256 does not match exported bytes for ${rel}; listing hash of current text.`
          });
        } else {
          fileSha = normalized;
        }
      }
      out.push({
        path: rel,
        content: text,
        contentType: ct,
        sha256: fileSha
      });
    }
    const nextOffset = page?.next_page_offset;
    offset = typeof nextOffset === 'string' || typeof nextOffset === 'number' ? nextOffset : undefined;
  } while (offset !== null && offset !== undefined);

  return { files: out, diagnostics };
}
