#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const fixtureRoot = path.join(repoRoot, 'tests/test-data/mime-artifact-sample');
const baseUrl = (process.env.KAIROS_BASE_URL || 'http://localhost:3300').replace(/\/$/, '');
const token = process.env.AUTH_BEARER_TOKEN || '';

const artifactPaths = [
  ['scripts/hello.py', 'text/x-python'],
  ['scripts/hello.sh', 'text/x-shellscript'],
  ['scripts/hello.cjs', 'text/javascript'],
  ['scripts/hello.pl', 'text/x-perl'],
  ['conf/app-config.toml', 'text/x-toml'],
  ['conf/routes.yaml', 'text/yaml'],
  ['notes.txt', 'text/plain']
];

const headers = {
  ...(token ? { Authorization: `Bearer ${token}` } : {})
};

function fixture(relPath) {
  return readFileSync(path.join(fixtureRoot, relPath), 'utf8');
}

async function postJson(endpoint, payload) {
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`${endpoint} failed ${res.status}: ${await res.text()}`);
  return res.json();
}

async function postRawTrain(markdown) {
  const res = await fetch(`${baseUrl}/api/train/raw?force=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/markdown', 'X-LLM-Model-ID': 'dev-script', ...headers },
    body: markdown
  });
  if (!res.ok) throw new Error(`/api/train/raw failed ${res.status}: ${await res.text()}`);
  return res.json();
}

function readSumsFromSkillTree(treeJson) {
  const tree = JSON.parse(treeJson);
  const skill = tree.skills?.[0];
  const sums = skill?.files?.find((f) => f.path === 'SHA256SUMS');
  return sums?.content || '';
}

async function main() {
  const adapterTrain = await postRawTrain(fixture('SKILL.md'));
  const adapterUri = adapterTrain.items?.[0]?.adapter_uri;
  if (!adapterUri) throw new Error('train/raw response missing adapter_uri');

  for (const [relPath, mime] of artifactPaths) {
    await postJson('/api/train', {
      llm_model_id: 'dev-script',
      content: fixture(relPath),
      mime,
      artifact_name: path.basename(relPath),
      adapter_uri: adapterUri,
      relative_path: relPath
    });
  }

  const tree = await postJson('/api/export', { uri: adapterUri, format: 'skill_tree' });
  const zip = await postJson('/api/export', { uri: adapterUri, format: 'skill_zip', delivery: 'inline_base64' });

  console.log('Adapter URI:', adapterUri);
  console.log('\n--- skill_tree SHA256SUMS ---\n');
  console.log(readSumsFromSkillTree(tree.content));
  console.log('\n--- skill_zip manifest ---\n');
  console.log(zip.skill_bundle_manifest);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
