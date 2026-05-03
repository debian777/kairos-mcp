import { readFileSync } from 'node:fs';
import path from 'node:path';

export interface MimeArtifactContract {
  artifactPaths: string[];
  mimeByPath: Record<string, string>;
  expectedArtifactSlugs: string[];
}

const CONTRACT_FILENAME = 'artifact-contract.json';

function validateContract(raw: unknown): MimeArtifactContract {
  if (!raw || typeof raw !== 'object') {
    throw new Error('mime artifact contract: root must be an object');
  }
  const o = raw as Record<string, unknown>;
  const paths = o.artifactPaths;
  const mimeByPath = o.mimeByPath;
  const slugs = o.expectedArtifactSlugs;
  if (!Array.isArray(paths) || paths.length === 0 || !paths.every((p) => typeof p === 'string')) {
    throw new Error('mime artifact contract: artifactPaths must be a non-empty string array');
  }
  if (!mimeByPath || typeof mimeByPath !== 'object') {
    throw new Error('mime artifact contract: mimeByPath must be an object');
  }
  const mimeMap = mimeByPath as Record<string, unknown>;
  for (const p of paths) {
    const m = mimeMap[p];
    if (typeof m !== 'string' || m.trim() === '') {
      throw new Error(`mime artifact contract: missing or invalid mime for path "${p}"`);
    }
  }
  const extraKeys = Object.keys(mimeMap).filter((k) => !paths.includes(k));
  if (extraKeys.length > 0) {
    throw new Error(`mime artifact contract: mimeByPath has keys not in artifactPaths: ${extraKeys.join(', ')}`);
  }
  if (!Array.isArray(slugs) || slugs.length !== paths.length || !slugs.every((s) => typeof s === 'string')) {
    throw new Error(
      'mime artifact contract: expectedArtifactSlugs must be a string array with same length as artifactPaths'
    );
  }
  return {
    artifactPaths: paths,
    mimeByPath: mimeMap as Record<string, string>,
    expectedArtifactSlugs: slugs
  };
}

/** Directory containing SKILL.md, SHA256SUMS, artifacts, and artifact-contract.json */
export function getMimeArtifactFixtureRoot(): string {
  return path.resolve('tests/test-data/mime-artifact-sample');
}

export function loadMimeArtifactContract(): MimeArtifactContract {
  const root = getMimeArtifactFixtureRoot();
  const raw = JSON.parse(readFileSync(path.join(root, CONTRACT_FILENAME), 'utf8')) as unknown;
  return validateContract(raw);
}

export function readMimeFixtureUtf8(relPath: string): string {
  const root = getMimeArtifactFixtureRoot();
  return readFileSync(path.join(root, relPath), 'utf8');
}
