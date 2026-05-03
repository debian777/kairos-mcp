import path from 'node:path';
import { parseZipEntries } from './zip-parser.js';

export interface BundleArtifactTrainInput {
  relative_path: string;
  mime: string;
  artifact_name: string;
  content: string;
}

export interface BundleTrainInput {
  skillMd: string;
  artifacts: BundleArtifactTrainInput[];
}

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = Object.freeze({
  '.py': 'text/x-python',
  '.sh': 'text/x-shellscript',
  '.cjs': 'text/javascript',
  '.pl': 'text/x-perl',
  '.toml': 'text/x-toml',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.txt': 'text/plain'
});

function parseSumsBody(body: string): string[] {
  const out: string[] = [];
  for (const raw of body.split('\n')) {
    const line = raw.trimEnd();
    if (!line) continue;
    const sep = line.indexOf('  ');
    if (sep <= 0) throw new Error(`Invalid SHA256SUMS row: ${line}`);
    out.push(line.slice(sep + 2));
  }
  return out;
}

function inferMime(relativePath: string): string {
  const ext = path.extname(relativePath).toLowerCase();
  const mime = MIME_BY_EXTENSION[ext];
  if (!mime) throw new Error(`Unsupported artifact extension in ${relativePath}`);
  return mime;
}

export function skillTreeToTrainInput(treeJson: string, slug: string): BundleTrainInput {
  const parsed = JSON.parse(treeJson) as {
    skills?: Array<{ slug?: string; files?: Array<{ path?: string; content?: string }> }>;
  };
  const skill = parsed.skills?.find((s) => s.slug === slug);
  if (!skill) throw new Error(`skill_tree missing slug ${slug}`);
  const files = new Map<string, string>();
  for (const file of skill.files ?? []) {
    if (typeof file.path === 'string' && typeof file.content === 'string') {
      files.set(file.path, file.content);
    }
  }
  return filesMapToTrainInput(files);
}

export function skillZipToTrainInput(buf: Buffer, slug: string): BundleTrainInput {
  const files = new Map<string, string>();
  for (const entry of parseZipEntries(buf)) {
    const prefix = `${slug}/`;
    if (!entry.path.startsWith(prefix)) continue;
    files.set(entry.path.slice(prefix.length), entry.content.toString('utf8'));
  }
  return filesMapToTrainInput(files);
}

function filesMapToTrainInput(files: Map<string, string>): BundleTrainInput {
  const skillMd = files.get('SKILL.md');
  const sums = files.get('SHA256SUMS');
  if (typeof skillMd !== 'string') throw new Error('Bundle missing SKILL.md');
  if (typeof sums !== 'string') throw new Error('Bundle missing SHA256SUMS');

  const artifacts: BundleArtifactTrainInput[] = [];
  for (const relPath of parseSumsBody(sums)) {
    if (relPath === 'SKILL.md' || relPath === 'SHA256SUMS') continue;
    const content = files.get(relPath);
    if (typeof content !== 'string') {
      throw new Error(`Bundle missing file listed in SHA256SUMS: ${relPath}`);
    }
    artifacts.push({
      relative_path: relPath,
      mime: inferMime(relPath),
      artifact_name: path.basename(relPath),
      content
    });
  }

  return { skillMd, artifacts };
}
