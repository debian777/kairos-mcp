import { describe, expect, it } from '@jest/globals';
import { normalizeArtifactRelativePath } from '../../src/tools/artifact-relative-path.js';

describe('normalizeArtifactRelativePath', () => {
  it('accepts a simple nested path', () => {
    expect(normalizeArtifactRelativePath('scripts/hello.py')).toBe('scripts/hello.py');
  });

  it('strips leading ./ segments', () => {
    expect(normalizeArtifactRelativePath('./conf/app.toml')).toBe('conf/app.toml');
    expect(normalizeArtifactRelativePath('././notes.txt')).toBe('notes.txt');
  });

  it('normalizes backslashes to slashes', () => {
    expect(normalizeArtifactRelativePath('scripts\\hello.py')).toBe('scripts/hello.py');
  });

  it('trims outer whitespace', () => {
    expect(normalizeArtifactRelativePath('  conf/routes.yaml  ')).toBe('conf/routes.yaml');
  });

  it('rejects empty and slash-only paths', () => {
    expect(normalizeArtifactRelativePath('')).toBeNull();
    expect(normalizeArtifactRelativePath('   ')).toBeNull();
    expect(normalizeArtifactRelativePath('/abs')).toBeNull();
    expect(normalizeArtifactRelativePath('a//b')).toBeNull();
    expect(normalizeArtifactRelativePath('a/')).toBeNull();
  });

  it('rejects .. segments', () => {
    expect(normalizeArtifactRelativePath('../etc/passwd')).toBeNull();
    expect(normalizeArtifactRelativePath('scripts/../../../etc')).toBeNull();
    expect(normalizeArtifactRelativePath('ok/../bad')).toBeNull();
  });

  it('rejects overlong paths', () => {
    const long = `${'a/'.repeat(1025)}b`;
    expect(normalizeArtifactRelativePath(long)).toBeNull();
  });
});
