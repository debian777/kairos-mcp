/**
 * Skill-root-relative paths for trained artifacts (train input + Qdrant payload).
 * Used for export layout preservation and validation (no path traversal).
 */

/** Normalize and validate a skill-root-relative path. Returns null if invalid. */
export function normalizeArtifactRelativePath(raw: string): string | null {
  let s = raw.trim().replace(/\\/g, '/');
  while (s.startsWith('./')) {
    s = s.slice(2);
  }
  if (s.startsWith('/')) {
    return null;
  }
  const segments = s.split('/');
  for (const seg of segments) {
    if (seg === '..') return null;
    if (seg === '') return null;
  }
  if (!s || s.endsWith('/')) {
    return null;
  }
  if (s.length > 2048) {
    return null;
  }
  return s;
}
