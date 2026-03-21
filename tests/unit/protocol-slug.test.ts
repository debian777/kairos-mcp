/**
 * Unit tests for protocol-slug.ts
 */

import {
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
    const r = resolveProtocolSlugCandidate({ slugRaw: 'my-slug', body: '' }, 'Ignored H1');
    expect(r).toEqual({ slug: 'my-slug', authorSupplied: true });
  });

  test('returns error for invalid author slug', () => {
    const r = resolveProtocolSlugCandidate({ slugRaw: 'bad_slug', body: '' }, 'H1');
    expect(r).toMatchObject({ error: 'INVALID_SLUG' });
  });

  test('derives from chain label when no slug', () => {
    const r = resolveProtocolSlugCandidate({ body: '' }, 'Hello World');
    expect(r).toEqual({ slug: 'hello-world', authorSupplied: false });
  });
});
