import path from 'node:path';
import {
  EXTENSION_TO_ALLOWED_MIMES,
  NO_EXTENSION_ALLOWED_MIMES
} from './skill-export/artifact-sanitization/extension-mime-map.js';

const UNIQUE_ALLOWED_MIMES = new Set<string>();

for (const mimes of Object.values(EXTENSION_TO_ALLOWED_MIMES)) {
  for (const mime of mimes) {
    UNIQUE_ALLOWED_MIMES.add(mime.toLowerCase());
  }
}
for (const mime of NO_EXTENSION_ALLOWED_MIMES) {
  UNIQUE_ALLOWED_MIMES.add(mime.toLowerCase());
}

/**
 * Canonical allowlist for train/export/source/listing artifact MIME types.
 * Keep this as the single source of truth for artifact MIME acceptance.
 */
export const ALLOWED_ARTIFACT_MIMES = Object.freeze([...UNIQUE_ALLOWED_MIMES]);

const ALLOWED_ARTIFACT_MIME_SET = new Set(ALLOWED_ARTIFACT_MIMES);

const EXTENSION_TO_PRIMARY_MIME = new Map<string, string>();
for (const [ext, mimes] of Object.entries(EXTENSION_TO_ALLOWED_MIMES)) {
  const first = mimes[0];
  if (typeof first === 'string' && first.trim().length > 0) {
    EXTENSION_TO_PRIMARY_MIME.set(ext.toLowerCase(), first.toLowerCase());
  }
}

export function normalizeArtifactMime(mime: string): string {
  return mime.trim().toLowerCase();
}

export function isAllowedArtifactMime(mime: string): boolean {
  return ALLOWED_ARTIFACT_MIME_SET.has(normalizeArtifactMime(mime));
}

export function inferArtifactMimeFromName(artifactName: string): string | null {
  const trimmed = artifactName.trim();
  if (trimmed.length === 0) return null;
  const ext = path.extname(path.basename(trimmed)).toLowerCase();
  if (!ext) return null;
  return EXTENSION_TO_PRIMARY_MIME.get(ext) ?? null;
}

