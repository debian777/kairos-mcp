import { createHash } from 'node:crypto';
import { zipSkillFiles } from '../../src/tools/skill-export/zip-bundle.js';
import {
  assertArtifactSumsMatchFixture,
  assertBundleSelfVerifies,
  assertSumsBodyByteIdentical,
  extractSumsFromSkillTree,
  extractSumsFromZip
} from '../utils/skill-bundle-sha-assert.js';

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

describe('skill-bundle-sha-assert', () => {
  it('extracts SHA rows from skill_tree', () => {
    const a = sha256('a');
    const s = sha256('s');
    const body = `${s}  SKILL.md\n${a}  notes.txt\n`;
    const tree = JSON.stringify({
      format: 'skill_tree',
      version: 1,
      skills: [{ slug: 'sample', files: [{ path: 'SHA256SUMS', content: body }] }]
    });
    const parsed = extractSumsFromSkillTree(tree, 'sample');
    expect(parsed.body).toBe(body);
    expect(parsed.rows.get('SKILL.md')).toBe(s);
    expect(parsed.rows.get('notes.txt')).toBe(a);
  });

  it('extracts SHA rows from skill_zip and self-verifies file bytes', async () => {
    const skill = '# skill\n';
    const note = 'hello';
    const sums =
      `${sha256(skill)}  SKILL.md\n` +
      `${sha256(note)}  notes.txt\n`;
    const zip = await zipSkillFiles([
      { path: 'sample/SKILL.md', content: skill },
      { path: 'sample/notes.txt', content: note },
      { path: 'sample/SHA256SUMS', content: sums }
    ]);
    const parsed = extractSumsFromZip(zip, 'sample');
    expect(parsed.rows.get('SKILL.md')).toBe(sha256(skill));
    expect(parsed.rows.get('notes.txt')).toBe(sha256(note));
    assertBundleSelfVerifies(parsed.files, parsed.body);
  });

  it('compares Stage 0 artifact rows only', () => {
    const fixture = new Map<string, string>([
      ['notes.txt', 'a'.repeat(64)],
      ['scripts/hello.py', 'b'.repeat(64)],
      ['SKILL.md', 'c'.repeat(64)]
    ]);
    const actual = new Map<string, string>([
      ['notes.txt', 'a'.repeat(64)],
      ['scripts/hello.py', 'b'.repeat(64)],
      ['SKILL.md', 'd'.repeat(64)]
    ]);
    assertArtifactSumsMatchFixture(actual, fixture, ['notes.txt', 'scripts/hello.py']);
  });

  it('checks byte-identical sums body in Stage 1+', () => {
    const body = `${'a'.repeat(64)}  SKILL.md\n`;
    assertSumsBodyByteIdentical(body, body);
  });
});
