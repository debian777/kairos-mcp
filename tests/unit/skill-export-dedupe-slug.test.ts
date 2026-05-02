import { describe, expect, it } from '@jest/globals';
import { dedupeSlug } from '../../src/tools/export-selection.js';

describe('dedupeSlug', () => {
  it('returns the base slug unchanged on first use and records it as taken', () => {
    const used = new Set<string>();
    expect(dedupeSlug('foo', used)).toBe('foo');
    expect(used.has('foo')).toBe(true);
  });

  it('produces __2, __3, ... in deterministic order on repeat collisions', () => {
    const used = new Set<string>();
    expect(dedupeSlug('foo', used)).toBe('foo');
    expect(dedupeSlug('foo', used)).toBe('foo__2');
    expect(dedupeSlug('foo', used)).toBe('foo__3');
    expect(dedupeSlug('foo', used)).toBe('foo__4');
    expect(used.has('foo')).toBe(true);
    expect(used.has('foo__2')).toBe(true);
    expect(used.has('foo__3')).toBe(true);
    expect(used.has('foo__4')).toBe(true);
  });

  it('skips occupied suffixes deterministically (foo__2 already taken externally)', () => {
    const used = new Set<string>(['foo', 'foo__2']);
    expect(dedupeSlug('foo', used)).toBe('foo__3');
    expect(dedupeSlug('foo', used)).toBe('foo__4');
  });

  it('keeps separate counters for different base slugs in the same run', () => {
    const used = new Set<string>();
    expect(dedupeSlug('alpha', used)).toBe('alpha');
    expect(dedupeSlug('beta', used)).toBe('beta');
    expect(dedupeSlug('alpha', used)).toBe('alpha__2');
    expect(dedupeSlug('beta', used)).toBe('beta__2');
    expect(dedupeSlug('alpha', used)).toBe('alpha__3');
  });

  it('treats the base slug case-sensitively (foo and Foo are distinct)', () => {
    const used = new Set<string>();
    expect(dedupeSlug('foo', used)).toBe('foo');
    expect(dedupeSlug('Foo', used)).toBe('Foo');
    expect(dedupeSlug('foo', used)).toBe('foo__2');
    expect(dedupeSlug('Foo', used)).toBe('Foo__2');
  });

  it('produces the same sequence given the same starting state (deterministic across calls)', () => {
    const seq1 = (() => {
      const used = new Set<string>();
      return [
        dedupeSlug('x', used),
        dedupeSlug('x', used),
        dedupeSlug('x', used),
        dedupeSlug('x', used)
      ];
    })();
    const seq2 = (() => {
      const used = new Set<string>();
      return [
        dedupeSlug('x', used),
        dedupeSlug('x', used),
        dedupeSlug('x', used),
        dedupeSlug('x', used)
      ];
    })();
    expect(seq1).toEqual(seq2);
    expect(seq1).toEqual(['x', 'x__2', 'x__3', 'x__4']);
  });
});
