/**
 * Optional artifact.relative_path on train → Qdrant payload → skill export paths.
 */

import {
  buildAdapterMarkdown,
  exportJson,
  trainAdapterMarkdown,
  trainArtifact,
  type ExportSkillTreeResponse
} from './skill-export-shared.js';

describe('artifact relative_path (skill export layout)', () => {
  test('skill_tree uses stored relative_path under the skill folder', async () => {
    const ts = Date.now().toString();
    const slug = `rel-export-${ts}`;
    const a = await trainAdapterMarkdown(buildAdapterMarkdown(slug, `Rel Export ${ts}`));
    // executeTrain trims artifact content end-to-end (same contract as skill-export-multi).
    const body = `print("rel-${ts}")`;
    const rel = `scripts/helper-${ts}.py`;
    await trainArtifact(a.adapterUri, `helper-${ts}.py`, 'text/x-python', `${body}\n`, {
      relative_path: rel
    });

    const data = await exportJson<ExportSkillTreeResponse>({ uri: a.adapterUri, format: 'skill_tree' });
    expect(data.format).toBe('skill_tree');
    const tree = JSON.parse(data.content) as {
      skills: Array<{ files: Array<{ path: string; content: string }>; diagnostics: unknown[] }>;
    };
    expect(tree.skills.length).toBe(1);
    const paths = tree.skills[0]!.files.map((f) => f.path);
    expect(paths).toContain(rel);
    expect(paths.some((p) => p.startsWith('artifacts/'))).toBe(false);
    const row = tree.skills[0]!.files.find((f) => f.path === rel);
    expect(row?.content).toBe(body);
  }, 60000);

  test('skill_tree uses flattened artifacts/<name> when relative_path is omitted (compat)', async () => {
    const ts = Date.now().toString();
    const slug = `flat-art-${ts}`;
    const a = await trainAdapterMarkdown(buildAdapterMarkdown(slug, `Flat Art ${ts}`));
    const artifactName = `stored-${ts}.toml`;
    const body = `key = "flat-${ts}"`;
    await trainArtifact(a.adapterUri, artifactName, 'text/x-toml', `${body}\n`);

    const data = await exportJson<ExportSkillTreeResponse>({ uri: a.adapterUri, format: 'skill_tree' });
    const tree = JSON.parse(data.content) as {
      skills: Array<{ files: Array<{ path: string; content: string }> }>;
    };
    const expectedPath = `artifacts/${artifactName}`;
    const paths = tree.skills[0]!.files.map((f) => f.path);
    expect(paths).toContain(expectedPath);
    expect(tree.skills[0]!.files.find((f) => f.path === expectedPath)?.content).toBe(body);
  }, 60000);
});
