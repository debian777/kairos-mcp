/**
 * Unit tests for protocol-slug.ts
 */

import {
  MAX_PROTOCOL_SLUG_LENGTH,
  nextAutoSlugCandidate,
  normalizeAuthorSlug,
  resolveProtocolSlugCandidate,
  slugifyFromTitle
} from '../../src/utils/protocol-slug.js';

describe('slugifyFromTitle', () => {
  test('lowercase and hyphenate', () => {
    expect(slugifyFromTitle('Standardize Project — Analyze')).toBe('standardize-project-analyze');
  });

  test('empty falls back to protocol', () => {
    expect(slugifyFromTitle('   !!!   ')).toBe('protocol');
  });

  test('caps length at MAX_PROTOCOL_SLUG_LENGTH', () => {
    const long = 'a'.repeat(500);
    expect(slugifyFromTitle(long).length).toBe(MAX_PROTOCOL_SLUG_LENGTH);
  });
});

describe('normalizeAuthorSlug', () => {
  test('accepts valid slug', () => {
    expect(normalizeAuthorSlug('analyze-and-plan')).toBe('analyze-and-plan');
  });

  test('rejects invalid characters', () => {
    expect(normalizeAuthorSlug('bad_slug')).toBeNull();
    expect(normalizeAuthorSlug('')).toBeNull();
  });
});

describe('resolveProtocolSlugCandidate', () => {
  test('uses author slug when valid', () => {
    const r = resolveProtocolSlugCandidate({ slugRaw: 'my-slug' }, 'Ignored H1');
    expect(r).toEqual({ slug: 'my-slug', authorSupplied: true });
  });

  test('returns error for invalid author slug', () => {
    const r = resolveProtocolSlugCandidate({ slugRaw: 'bad_slug' }, 'H1');
    expect(r).toMatchObject({ error: 'INVALID_SLUG' });
  });

  test('derives from adapter label when no slug', () => {
    const r = resolveProtocolSlugCandidate({}, 'Hello World');
    expect(r).toEqual({ slug: 'hello-world', authorSupplied: false });
  });
});

describe('nextAutoSlugCandidate', () => {
  test('suffix keeps total length within cap', () => {
    const base = 'a'.repeat(MAX_PROTOCOL_SLUG_LENGTH);
    const c = nextAutoSlugCandidate(base, 100);
    expect(c.length).toBeLessThanOrEqual(MAX_PROTOCOL_SLUG_LENGTH);
    expect(c.endsWith('-100')).toBe(true);
  });
});
