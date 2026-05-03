import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseZipEntries } from './zip-parser.js';

const FIXTURE_SUMS = path.resolve('tests/test-data/mime-artifact-sample/SHA256SUMS');
const HEX64_RE = /^[a-f0-9]{64}$/;
const SUM_LINE_RE = /^([a-f0-9]{64})  (.+)$/;

export interface ParsedSums {
  body: string;
  rows: Map<string, string>;
}

function sha256Hex(input: Buffer | string): string {
  return createHash('sha256').update(input).digest('hex');
}

function parseSumsBody(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const raw of body.split('\n')) {
    const line = raw.trimEnd();
    if (!line) continue;
    const m = SUM_LINE_RE.exec(line);
    if (!m) throw new Error(`Invalid SHA256SUMS line: ${line}`);
    out.set(m[2]!, m[1]!.toLowerCase());
  }
  return out;
}

export function loadFixtureSums(): Map<string, string> {
  return parseSumsBody(readFileSync(FIXTURE_SUMS, 'utf8'));
}

export function extractSumsFromSkillTree(treeJson: string, slug: string): ParsedSums {
  const parsed = JSON.parse(treeJson) as {
    skills?: Array<{ slug?: string; files?: Array<{ path?: string; content?: string }> }>;
  };
  const skill = parsed.skills?.find((s) => s.slug === slug);
  if (!skill) throw new Error(`skill_tree missing slug ${slug}`);
  const sums = skill.files?.find((f) => f.path === 'SHA256SUMS');
  if (!sums || typeof sums.content !== 'string') {
    throw new Error(`skill_tree missing ${slug}/SHA256SUMS`);
  }
  return { body: sums.content, rows: parseSumsBody(sums.content) };
}

export function extractSumsFromZip(buf: Buffer, slug: string): ParsedSums & { files: Map<string, Buffer> } {
  const entries = parseZipEntries(buf);
  const files = new Map<string, Buffer>();
  for (const entry of entries) {
    files.set(entry.path, Buffer.from(entry.content));
  }
  const sumsPath = `${slug}/SHA256SUMS`;
  const sumsFile = files.get(sumsPath);
  if (!sumsFile) throw new Error(`skill_zip missing ${sumsPath}`);
  const body = sumsFile.toString('utf8');
  return { body, rows: parseSumsBody(body), files };
}

export function assertArtifactSumsMatchFixture(
  actualRows: Map<string, string>,
  fixtureRows: Map<string, string>,
  artifactPaths: string[]
): void {
  for (const artifactPath of artifactPaths) {
    const expected = fixtureRows.get(artifactPath);
    const actual = actualRows.get(artifactPath);
    if (!expected) throw new Error(`fixture missing ${artifactPath}`);
    if (!actual) throw new Error(`export missing ${artifactPath}`);
    expect(actual).toBe(expected);
  }
}

export function assertSumsBodyByteIdentical(prevBody: string, nextBody: string): void {
  expect(nextBody).toBe(prevBody);
}

export function assertBundleSelfVerifies(files: Map<string, Buffer>, sumsBody: string): void {
  const rows = parseSumsBody(sumsBody);
  for (const [relPath, listedHash] of rows.entries()) {
    const file =
      files.get(relPath) ??
      [...files.entries()].find(([p]) => p.endsWith(`/${relPath}`))?.[1];
    if (!file) throw new Error(`Missing file for row ${relPath}`);
    const actualHash = sha256Hex(file!);
    expect(HEX64_RE.test(listedHash)).toBe(true);
    expect(actualHash).toBe(listedHash);
  }
}
