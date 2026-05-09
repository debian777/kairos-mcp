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
import { listAdapterArtifacts } from '../artifact-catalog.js';

const SHA256_HEX_RE = /^[a-f0-9]{64}$/i;

function isValidStoredArtifactSha256(value: unknown): value is string {
  return typeof value === 'string' && SHA256_HEX_RE.test(value);
}

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
  const out: SkillExportFile[] = [];
  const diagnostics: SkillExportDiagnostic[] = [];
  const artifacts = await listAdapterArtifacts(memoryStore, adapterId);
  for (const artifact of artifacts) {
    const name = artifact.name;
    const text = artifact.text;
    const ct = artifact.content_type;
    const safeName = name.replace(/[/\\]/g, '_');
    const storedRel = artifact.relative_path ?? '';
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
    const stored = artifact.sha256;
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

  return { files: out, diagnostics };
}
