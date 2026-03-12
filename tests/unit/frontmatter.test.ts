/**
 * Unit tests for frontmatter.ts: YAML-like frontmatter parsing for protocol version.
 */

import { parseFrontmatter } from '../../src/utils/frontmatter.js';

describe('parseFrontmatter', () => {
  test('no frontmatter returns body as original', () => {
    const text = '# Title\n\nContent here.';
    const result = parseFrontmatter(text);
    expect(result.body).toBe(text);
    expect(result.version).toBeUndefined();
    expect(result.title).toBeUndefined();
  });

  test('parses version and title from frontmatter', () => {
    const text = `---
version: 1.0.0
title: My Protocol
---

# My Protocol

Content after.`;
    const result = parseFrontmatter(text);
    expect(result.version).toBe('1.0.0');
    expect(result.title).toBe('My Protocol');
    expect(result.body).toContain('# My Protocol');
    expect(result.body).toContain('Content after.');
    expect(result.body.trimStart()).toMatch(/^# My Protocol/);
  });

  test('quoted values are stripped of quotes', () => {
    const text = `---
version: "2.3.4"
title: 'Quoted Title'
---

# Body`;
    const result = parseFrontmatter(text);
    expect(result.version).toBe('2.3.4');
    expect(result.title).toBe('Quoted Title');
    expect(result.body.trim()).toBe('# Body');
  });

  test('only first --- block is parsed; body includes rest', () => {
    const text = `---
version: 1.0.0
---

# H1

Some content with --- dashes.`;
    const result = parseFrontmatter(text);
    expect(result.version).toBe('1.0.0');
    expect(result.body).toContain('# H1');
    expect(result.body).toContain('--- dashes.');
  });

  test('no closing --- returns body as original', () => {
    const text = `---
version: 1.0.0

# No closing delimiter`;
    const result = parseFrontmatter(text);
    expect(result.body).toBe(text);
    expect(result.version).toBeUndefined();
  });

  test('empty document returns body', () => {
    const result = parseFrontmatter('');
    expect(result.body).toBe('');
    expect(result.version).toBeUndefined();
  });

  test('whitespace before first ---: body is content after closing ---', () => {
    const text = '  \n---\nversion: 1\n---\n# Hi';
    const result = parseFrontmatter(text);
    expect(result.version).toBe('1');
    expect(result.body.trim()).toBe('# Hi');
  });
});
