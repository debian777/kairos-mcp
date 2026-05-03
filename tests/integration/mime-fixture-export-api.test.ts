import { readFileSync } from 'node:fs';
import path from 'node:path';
import { waitForHealthCheck } from '../utils/health-check.js';
import {
  SKILL_EXPORT_API_BASE,
  type ExportSkillTreeResponse,
  type ExportSkillZipResponse,
  SKILL_EXPORT_BASE_URL,
  downloadSkillZip,
  exportJson,
  trainAdapterMarkdown
} from './skill-export-shared.js';
import { getAuthHeaders } from '../utils/auth-headers.js';
import {
  assertArtifactSumsMatchFixture,
  assertBundleSelfVerifies,
  assertSumsBodyByteIdentical,
  extractSumsFromSkillTree,
  extractSumsFromZip,
  loadFixtureSums
} from '../utils/skill-bundle-sha-assert.js';
import {
  skillTreeToTrainInput,
  skillZipToTrainInput
} from '../utils/skill-bundle-to-train-input.js';
import { cleanupViaApi } from '../utils/artifact-fixture-cleanup.js';

const FIXTURE_ROOT = path.resolve('tests/test-data/mime-artifact-sample');
const ARTIFACT_PATHS = [
  'scripts/hello.py',
  'scripts/hello.sh',
  'scripts/hello.cjs',
  'scripts/hello.pl',
  'conf/app-config.toml',
  'conf/routes.yaml',
  'notes.txt'
];
const MIME_BY_PATH = new Map<string, string>([
  ['scripts/hello.py', 'text/x-python'],
  ['scripts/hello.sh', 'text/x-shellscript'],
  ['scripts/hello.cjs', 'text/javascript'],
  ['scripts/hello.pl', 'text/x-perl'],
  ['conf/app-config.toml', 'text/x-toml'],
  ['conf/routes.yaml', 'text/yaml'],
  ['notes.txt', 'text/plain']
]);
const EXPECTED_ARTIFACT_SLUGS = [
  'scripts-hello-py',
  'scripts-hello-sh',
  'scripts-hello-cjs',
  'scripts-hello-pl',
  'conf-app-config-toml',
  'conf-routes-yaml',
  'notes-txt'
];

function fixture(relPath: string): string {
  return readFileSync(path.join(FIXTURE_ROOT, relPath), 'utf8');
}

async function exportBundle(
  adapterUri: string,
  format: 'skill_tree' | 'skill_zip'
): Promise<{
  slug: string;
  sumsBody: string;
  sumsRows: Map<string, string>;
  files: Map<string, Buffer>;
  sourceSlugs?: string[];
}> {
  if (format === 'skill_tree') {
    const tree = await exportJson<ExportSkillTreeResponse>({ uri: adapterUri, format: 'skill_tree' });
    const parsedTree = JSON.parse(tree.content) as {
      skills: Array<{ slug: string; files: Array<{ path: string; content: string }> }>;
    };
    const skill = parsedTree.skills[0]!;
    const files = new Map<string, Buffer>();
    for (const f of skill.files) files.set(f.path, Buffer.from(f.content, 'utf8'));
    const sums = extractSumsFromSkillTree(tree.content, skill.slug);
    return { slug: skill.slug, sumsBody: sums.body, sumsRows: sums.rows, files };
  }

  const zip = await exportJson<ExportSkillZipResponse>({ uri: adapterUri, format: 'skill_zip' });
  const manifest = JSON.parse(zip.skill_bundle_manifest) as { skills: Array<{ slug: string }> };
  const slug = manifest.skills[0]!.slug;
  const zipBytes = await downloadSkillZip(zip);
  const parsed = extractSumsFromZip(zipBytes, slug);
  return {
    slug,
    sumsBody: parsed.body,
    sumsRows: parsed.rows,
    files: parsed.files
  };
}

async function stage0TrainFixture(): Promise<{
  adapterUri: string;
  artifactUris: string[];
}> {
  const adapter = await trainAdapterMarkdown(fixture('SKILL.md'));
  const artifactUris: string[] = [];
  for (const relPath of ARTIFACT_PATHS) {
    const res = await fetch(`${SKILL_EXPORT_API_BASE}/train`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        llm_model_id: 'test-model',
        content: fixture(relPath),
        mime: MIME_BY_PATH.get(relPath)!,
        artifact_name: path.basename(relPath),
        adapter_uri: adapter.adapterUri,
        relative_path: relPath
      })
    });
    if (!res.ok) throw new Error(`artifact train failed (${relPath}): ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { items?: Array<{ artifact_uuid?: string }> };
    const uuid = data.items?.[0]?.artifact_uuid;
    if (!uuid) throw new Error(`artifact train response missing artifact_uuid for ${relPath}`);
    artifactUris.push(`kairos://layer/${uuid}`);
  }
  return { adapterUri: adapter.adapterUri, artifactUris };
}

async function retrainFromBundle(
  format: 'skill_tree' | 'skill_zip',
  slug: string,
  exportPayload: string | Buffer
): Promise<{ adapterUri: string; artifactUris: string[] }> {
  const trainInput =
    format === 'skill_tree'
      ? skillTreeToTrainInput(String(exportPayload), slug)
      : skillZipToTrainInput(exportPayload as Buffer, slug);
  const adapter = await trainAdapterMarkdown(trainInput.skillMd);
  const artifactUris: string[] = [];
  for (const artifact of trainInput.artifacts) {
    const res = await fetch(`${SKILL_EXPORT_API_BASE}/train`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        llm_model_id: 'test-model',
        content: artifact.content,
        mime: artifact.mime,
        artifact_name: artifact.artifact_name,
        adapter_uri: adapter.adapterUri,
        relative_path: artifact.relative_path
      })
    });
    if (!res.ok) {
      throw new Error(
        `roundtrip artifact train failed (${artifact.relative_path}): ${res.status} ${await res.text()}`
      );
    }
    const data = (await res.json()) as { items?: Array<{ artifact_uuid?: string }> };
    const uuid = data.items?.[0]?.artifact_uuid;
    if (!uuid) throw new Error(`roundtrip train missing artifact_uuid for ${artifact.relative_path}`);
    artifactUris.push(`kairos://layer/${uuid}`);
  }
  return { adapterUri: adapter.adapterUri, artifactUris };
}

describe('mime fixture export parity via API transport', () => {
  beforeAll(async () => {
    await waitForHealthCheck({ url: `${SKILL_EXPORT_BASE_URL}/health`, timeoutMs: 60000, intervalMs: 500 });
  }, 60000);

  test.each(['skill_tree', 'skill_zip'] as const)(
    'Stage 0/1/2 SHA contract for %s',
    async (format) => {
      const fixtureRows = loadFixtureSums();
      const stage0 = await stage0TrainFixture();
      const b0 = await exportBundle(stage0.adapterUri, format);
      assertArtifactSumsMatchFixture(b0.sumsRows, fixtureRows, ARTIFACT_PATHS);
      assertBundleSelfVerifies(b0.files, b0.sumsBody);

      const source = await exportJson<{ content: string }>({ uri: stage0.adapterUri, format: 'source' });
      const sourcePayload = JSON.parse(source.content) as { artifacts?: Array<{ slug: string }> };
      const sourceSlugs = (sourcePayload.artifacts ?? []).map((a) => a.slug).sort();
      expect(sourceSlugs).toEqual(EXPECTED_ARTIFACT_SLUGS.sort());

      const stage1TrainInput =
        format === 'skill_tree'
          ? await exportJson<ExportSkillTreeResponse>({ uri: stage0.adapterUri, format: 'skill_tree' }).then((v) => v.content)
          : await exportJson<ExportSkillZipResponse>({ uri: stage0.adapterUri, format: 'skill_zip' }).then(downloadSkillZip);

      await cleanupViaApi(stage0.adapterUri, stage0.artifactUris);
      const stage1 = await retrainFromBundle(format, b0.slug, stage1TrainInput);
      const b1 = await exportBundle(stage1.adapterUri, format);
      assertSumsBodyByteIdentical(b0.sumsBody, b1.sumsBody);
      assertBundleSelfVerifies(b1.files, b1.sumsBody);

      const stage2Input =
        format === 'skill_tree'
          ? await exportJson<ExportSkillTreeResponse>({ uri: stage1.adapterUri, format: 'skill_tree' }).then((v) => v.content)
          : await exportJson<ExportSkillZipResponse>({ uri: stage1.adapterUri, format: 'skill_zip' }).then(downloadSkillZip);

      await cleanupViaApi(stage1.adapterUri, stage1.artifactUris);
      const stage2 = await retrainFromBundle(format, b1.slug, stage2Input);
      const b2 = await exportBundle(stage2.adapterUri, format);
      assertSumsBodyByteIdentical(b1.sumsBody, b2.sumsBody);
      assertBundleSelfVerifies(b2.files, b2.sumsBody);

      await cleanupViaApi(stage2.adapterUri, stage2.artifactUris);
    },
    120000
  );
});
