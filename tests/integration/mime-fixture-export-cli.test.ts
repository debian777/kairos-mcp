/**
 * CLI cannot ingest non-markdown artifact MIME inputs today.
 * This test pre-trains the fixture via API in beforeAll, then validates
 * Stage 0 export parity via CLI-only export/delete commands.
 */

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path, { join } from 'node:path';
import { getAuthHeaders } from '../utils/auth-headers.js';
import {
  BASE_URL,
  CLI_PATH,
  execAsync,
  requireMcpServerAndCliLogin,
  setupCliConfigWithLogin,
  setupServerCheck
} from './cli-commands-shared.js';
import {
  assertArtifactSumsMatchFixture,
  assertBundleSelfVerifies,
  extractSumsFromSkillTree,
  extractSumsFromZip,
  loadFixtureSums
} from '../utils/skill-bundle-sha-assert.js';
import { cleanupViaCli } from '../utils/artifact-fixture-cleanup.js';

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

interface TrainResponse {
  items?: Array<{ adapter_uri?: string; artifact_uuid?: string }>;
}

function fixture(relPath: string): string {
  return readFileSync(path.join(FIXTURE_ROOT, relPath), 'utf8');
}

async function pretrainFixtureViaApi(): Promise<{ adapterUri: string; artifactLayerUris: string[] }> {
  const trainAdapter = await fetch(`${BASE_URL}/api/train/raw?force=true`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/markdown',
      'X-LLM-Model-ID': 'test-model',
      ...getAuthHeaders()
    },
    body: fixture('SKILL.md')
  });
  if (!trainAdapter.ok) throw new Error(`train/raw failed ${trainAdapter.status}: ${await trainAdapter.text()}`);
  const adapterJson = (await trainAdapter.json()) as TrainResponse;
  const adapterUri = String(adapterJson.items?.[0]?.adapter_uri ?? '');
  if (!adapterUri.startsWith('kairos://adapter/')) throw new Error(`missing adapter_uri in train/raw response`);

  const artifactLayerUris: string[] = [];
  for (const relPath of ARTIFACT_PATHS) {
    const res = await fetch(`${BASE_URL}/api/train`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        llm_model_id: 'test-model',
        content: fixture(relPath),
        mime: MIME_BY_PATH.get(relPath),
        artifact_name: path.basename(relPath),
        adapter_uri: adapterUri,
        relative_path: relPath
      })
    });
    if (!res.ok) throw new Error(`artifact train failed ${relPath}: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as TrainResponse;
    const artifactUuid = String(data.items?.[0]?.artifact_uuid ?? '');
    if (!artifactUuid) throw new Error(`missing artifact_uuid for ${relPath}`);
    artifactLayerUris.push(`kairos://layer/${artifactUuid}`);
  }
  return { adapterUri, artifactLayerUris };
}

describe('mime fixture export parity via CLI transport', () => {
  let serverAvailable = false;
  let cliLoggedIn = false;
  let adapterUri = '';
  let artifactLayerUris: string[] = [];

  beforeAll(async () => {
    serverAvailable = await setupServerCheck();
    cliLoggedIn = await setupCliConfigWithLogin();
    requireMcpServerAndCliLogin(serverAvailable, cliLoggedIn);
    const trained = await pretrainFixtureViaApi();
    adapterUri = trained.adapterUri;
    artifactLayerUris = trained.artifactLayerUris;
  }, 120000);

  afterAll(async () => {
    if (adapterUri) {
      await cleanupViaCli(adapterUri, artifactLayerUris);
    }
  });

  test('Stage 0 CLI skill_tree + skill_zip exports match fixture artifact rows', async () => {
    requireMcpServerAndCliLogin(serverAvailable, cliLoggedIn);
    const fixtureRows = loadFixtureSums();

    const { stdout: treeStdout } = await execAsync(
      `node ${CLI_PATH} export --url ${BASE_URL} --format skill_tree ${adapterUri}`
    );
    const treeParsed = JSON.parse(treeStdout) as {
      skills: Array<{ slug: string; files: Array<{ path: string; content: string }> }>;
    };
    const slug = treeParsed.skills[0]!.slug;
    const tree = extractSumsFromSkillTree(treeStdout, slug);
    assertArtifactSumsMatchFixture(tree.rows, fixtureRows, ARTIFACT_PATHS);
    const treeFiles = new Map<string, Buffer>();
    for (const f of treeParsed.skills[0]!.files) treeFiles.set(f.path, Buffer.from(f.content, 'utf8'));
    assertBundleSelfVerifies(treeFiles, tree.body);

    const outDir = mkdtempSync(join(tmpdir(), 'mime-fixture-cli-'));
    const zipOut = join(outDir, 'bundle.zip');
    await execAsync(`node ${CLI_PATH} export --url ${BASE_URL} --format skill_zip --zip-out ${zipOut} ${adapterUri}`);
    const zipBytes = readFileSync(zipOut);
    const zip = extractSumsFromZip(zipBytes, slug);
    assertArtifactSumsMatchFixture(zip.rows, fixtureRows, ARTIFACT_PATHS);
    assertBundleSelfVerifies(zip.files, zip.body);

    expect(zip.body).toBe(tree.body);
  }, 120000);
});
