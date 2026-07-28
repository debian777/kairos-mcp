import path from 'node:path';
import { isHttpTransport } from '../../utils/auth-headers.js';
import {
  type ExportSkillTreeResponse,
  type ExportSkillZipResponse,
  downloadSkillZip,
  exportJson,
  trainAdapterMarkdown,
  trainArtifact,
  trainArtifactCleanupUri
} from '../skill-export-shared.js';
import {
  assertArtifactSumsMatchFixture,
  assertBundleSelfVerifies,
  assertSumsBodyByteIdentical,
  extractSumsFromSkillTree,
  extractSumsFromZip,
  loadFixtureSums
} from '../../utils/skill-bundle-sha-assert.js';
import {
  skillTreeToTrainInput,
  skillZipToTrainInput
} from '../../utils/skill-bundle-to-train-input.js';
import { cleanupViaApi } from '../../utils/artifact-fixture-cleanup.js';
import { loadMimeArtifactContract, readMimeFixtureUtf8 } from '../../utils/mime-artifact-fixture-contract.js';
import {
  dumpMimeFixtureExport,
  ensureMimeFixtureExportDumpRootCleanBeforeMimeTests
} from '../../utils/mime-fixture-export-dump.js';

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
  const contract = loadMimeArtifactContract();
  const adapter = await trainAdapterMarkdown(readMimeFixtureUtf8('SKILL.md'));
  const artifactUris: string[] = [];
  for (const relPath of contract.artifactPaths) {
    const mime = contract.mimeByPath[relPath];
    if (!mime) throw new Error(`missing mime for ${relPath}`);
    const r = await trainArtifact(adapter.adapterUri, path.basename(relPath), mime, readMimeFixtureUtf8(relPath), {
      relative_path: relPath
    });
    artifactUris.push(trainArtifactCleanupUri(r));
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
    const r = await trainArtifact(adapter.adapterUri, artifact.artifact_name, artifact.mime, artifact.content, {
      relative_path: artifact.relative_path
    });
    artifactUris.push(trainArtifactCleanupUri(r));
  }
  return { adapterUri: adapter.adapterUri, artifactUris };
}

const _d = isHttpTransport() ? describe : describe.skip;

_d('mime fixture export parity via API transport', () => {
  beforeAll(async () => {
    ensureMimeFixtureExportDumpRootCleanBeforeMimeTests();
  }, 60000);

  test.each(['skill_tree', 'skill_zip'] as const)(
    'Stage 0/1/2 SHA contract for %s',
    async (format) => {
      const contract = loadMimeArtifactContract();
      const fixtureRows = loadFixtureSums();
      const stage0 = await stage0TrainFixture();
      const b0 = await exportBundle(stage0.adapterUri, format);
      dumpMimeFixtureExport({
        transport: 'api',
        format,
        stage: 0,
        slug: b0.slug,
        files: b0.files,
        sumsBody: b0.sumsBody
      });
      assertArtifactSumsMatchFixture(b0.sumsRows, fixtureRows, contract.artifactPaths);
      assertBundleSelfVerifies(b0.files, b0.sumsBody);

      const source = await exportJson<{ content: string }>({ uri: stage0.adapterUri, format: 'source' });
      const sourcePayload = JSON.parse(source.content) as { artifacts?: Array<{ slug: string }> };
      const sourceSlugs = (sourcePayload.artifacts ?? []).map((a) => a.slug).sort();
      expect(sourceSlugs).toEqual([...contract.expectedArtifactSlugs].sort());

      const stage1TrainInput =
        format === 'skill_tree'
          ? await exportJson<ExportSkillTreeResponse>({ uri: stage0.adapterUri, format: 'skill_tree' }).then((v) => v.content)
          : await exportJson<ExportSkillZipResponse>({ uri: stage0.adapterUri, format: 'skill_zip' }).then(downloadSkillZip);

      await cleanupViaApi(stage0.adapterUri, stage0.artifactUris);
      const stage1 = await retrainFromBundle(format, b0.slug, stage1TrainInput);
      const b1 = await exportBundle(stage1.adapterUri, format);
      dumpMimeFixtureExport({
        transport: 'api',
        format,
        stage: 1,
        slug: b1.slug,
        files: b1.files,
        sumsBody: b1.sumsBody
      });
      assertSumsBodyByteIdentical(b0.sumsBody, b1.sumsBody);
      assertBundleSelfVerifies(b1.files, b1.sumsBody);

      const stage2Input =
        format === 'skill_tree'
          ? await exportJson<ExportSkillTreeResponse>({ uri: stage1.adapterUri, format: 'skill_tree' }).then((v) => v.content)
          : await exportJson<ExportSkillZipResponse>({ uri: stage1.adapterUri, format: 'skill_zip' }).then(downloadSkillZip);

      await cleanupViaApi(stage1.adapterUri, stage1.artifactUris);
      const stage2 = await retrainFromBundle(format, b1.slug, stage2Input);
      const b2 = await exportBundle(stage2.adapterUri, format);
      dumpMimeFixtureExport({
        transport: 'api',
        format,
        stage: 2,
        slug: b2.slug,
        files: b2.files,
        sumsBody: b2.sumsBody
      });
      assertSumsBodyByteIdentical(b1.sumsBody, b2.sumsBody);
      assertBundleSelfVerifies(b2.files, b2.sumsBody);

      await cleanupViaApi(stage2.adapterUri, stage2.artifactUris);
    },
    120000
  );
});
