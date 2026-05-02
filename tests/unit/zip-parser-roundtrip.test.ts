/**
 * Self-test for the test-only ZIP parser: round-trip through archiver and assert that decoded
 * entries match the inputs byte-for-byte. Catches regressions in the helper itself before it is
 * relied on by integration tests.
 */

import { describe, expect, it } from '@jest/globals';
import { zipSkillFiles } from '../../src/tools/skill-export/zip-bundle.js';
import { indexZipEntriesByPath, parseZipEntries } from '../utils/zip-parser.js';

describe('test ZIP parser round-trip', () => {
  it('decodes archiver-deflate output into the same paths and bytes that went in', async () => {
    const inputs = [
      { path: 'foo/SKILL.md', content: '# Foo\n\nbody.\n' },
      { path: 'foo/artifacts/a.py', content: 'print("hello a")\n' },
      { path: 'bar/SKILL.md', content: '# Bar\n\nbody.\n' },
      { path: 'bar/SHA256SUMS', content: 'deadbeef  SKILL.md\n' }
    ];
    const buf = await zipSkillFiles(inputs);
    expect(buf.subarray(0, 2).toString('binary')).toBe('PK');

    const entries = parseZipEntries(buf);
    expect(entries.length).toBe(inputs.length);

    const byPath = indexZipEntriesByPath(buf);
    for (const f of inputs) {
      const got = byPath.get(f.path);
      expect(got).toBeDefined();
      expect(got!.content.toString('utf8')).toBe(f.content);
    }
  });
});
