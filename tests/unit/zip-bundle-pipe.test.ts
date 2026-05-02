import { describe, expect, it } from '@jest/globals';
import { PassThrough } from 'node:stream';
import { finished } from 'node:stream/promises';
import { pipeSkillZipToWritable } from '../../src/tools/skill-export/zip-bundle.js';

describe('pipeSkillZipToWritable', () => {
  it('writes a valid local file header ZIP to the destination stream', async () => {
    const chunks: Buffer[] = [];
    const dest = new PassThrough();
    dest.on('data', (c: Buffer) => chunks.push(c));
    const done = finished(dest);
    await pipeSkillZipToWritable(dest, [
      { path: 'a/hello.txt', content: 'hi' },
      { path: 'b/x.md', content: '# x\n' }
    ]);
    dest.end();
    await done;
    const buf = Buffer.concat(chunks);
    expect(buf.length).toBeGreaterThan(4);
    expect(buf.subarray(0, 2).toString('binary')).toBe('PK');
  });
});
