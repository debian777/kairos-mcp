/**
 * Protocol slug: deterministic routing key (exact match in Qdrant), distinct from fuzzy title search.
 */

import type { ParsedFrontmatter } from './frontmatter.js';

/** Strict slug pattern: lowercase, digits, single hyphens between segments. */
const AUTHOR_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const MAX_AUTO_SUFFIX_ATTEMPTS = 100;

/**
 * Derive a slug from an H1-style title: lowercase, alnum + hyphens, no leading/trailing hyphen.
 */
export function slugifyFromTitle(h1: string): string {
  const s = (h1 || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s || 'protocol';
}

/**
 * Validate an author-supplied frontmatter slug. Returns normalized slug or null if invalid.
 */
export function normalizeAuthorSlug(raw: string): string | null {
  const t = (raw || '').trim().toLowerCase();
  if (!t || t.length > 200) return null;
  if (!AUTHOR_SLUG_RE.test(t)) return null;
  return t;
}

export interface ResolvedProtocolSlug {
  slug: string;
  /** True when `slug` came from frontmatter `slug:` (must not auto-suffix on collision). */
  authorSupplied: boolean;
}

/**
 * Resolve final slug candidate before uniqueness allocation.
 * Throws nothing; invalid explicit slug should be handled by caller (MintError).
 */
export function resolveProtocolSlugCandidate(
  parsed: Pick<ParsedFrontmatter, 'slugRaw'>,
  chainLabel: string
): ResolvedProtocolSlug | { error: 'INVALID_SLUG'; message: string } {
  if (parsed.slugRaw !== undefined) {
    const normalized = normalizeAuthorSlug(parsed.slugRaw);
    if (!normalized) {
      return {
        error: 'INVALID_SLUG',
        message:
          'Frontmatter slug must be lowercase letters, digits, and single hyphens only (e.g. analyze-and-plan).'
      };
    }
    return { slug: normalized, authorSupplied: true };
  }
  return { slug: slugifyFromTitle(chainLabel), authorSupplied: false };
}

/**
 * If auto-generated slug collides, append -2, -3, ... until free or cap.
 */
export function nextAutoSlugCandidate(baseSlug: string, attempt: number): string {
  if (attempt <= 1) return baseSlug;
  return `${baseSlug}-${attempt}`;
}

export { AUTHOR_SLUG_RE, MAX_AUTO_SUFFIX_ATTEMPTS };
