import { createHash } from 'node:crypto';
import { zipSkillFiles } from '../../src/tools/skill-export/zip-bundle.js';
import {
  skillTreeToTrainInput,
  skillZipToTrainInput
} from '../utils/skill-bundle-to-train-input.js';

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

describe('skill-bundle-to-train-input', () => {
  it('parses skill_tree into train-ready structure', () => {
    const skillMd = '# s\n';
    const py = 'print("hi")\n';
    const sums =
      `${sha256(skillMd)}  SKILL.md\n` +
      `${sha256(py)}  scripts/hello.py\n`;

    const tree = JSON.stringify({
      skills: [
        {
          slug: 'sample',
          files: [
            { path: 'SKILL.md', content: skillMd },
            { path: 'scripts/hello.py', content: py },
            { path: 'SHA256SUMS', content: sums }
          ]
        }
      ]
    });

    const parsed = skillTreeToTrainInput(tree, 'sample');
    expect(parsed.skillMd).toBe(skillMd);
    expect(parsed.artifacts).toEqual([
      {
        relative_path: 'scripts/hello.py',
        mime: 'text/x-python',
        artifact_name: 'hello.py',
        content: py
      }
    ]);
  });

  it('parses skill_zip into train-ready structure', async () => {
    const skillMd = '# zip\n';
    const txt = 'hello';
    const sums =
      `${sha256(skillMd)}  SKILL.md\n` +
      `${sha256(txt)}  notes.txt\n`;
    const zip = await zipSkillFiles([
      { path: 'sample/SKILL.md', content: skillMd },
      { path: 'sample/notes.txt', content: txt },
      { path: 'sample/SHA256SUMS', content: sums }
    ]);
    const parsed = skillZipToTrainInput(zip, 'sample');
    expect(parsed.skillMd).toBe(skillMd);
    expect(parsed.artifacts[0]).toEqual({
      relative_path: 'notes.txt',
      mime: 'text/plain',
      artifact_name: 'notes.txt',
      content: txt
    });
  });
});
