#!/usr/bin/env node
/**
 * Sync or check versions with two targets:
 * - src/embed-docs/mem/*.md frontmatter = package.json version (current app, can be prerelease).
 * - skills/** (SKILL.md metadata.version + references/KAIROS.md frontmatter) = last stable
 *   (latest git tag vX.Y.Z or 1.0.0).
 * - Default: update files to the appropriate target.
 * - --check: compare; exit 1 if any version differs from its target.
 *
 * Usage: node scripts/sync-skill-versions.mjs [--check]
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(REPO_ROOT, 'skills');
const MEM_DIR = path.join(REPO_ROOT, 'src', 'embed-docs', 'mem');

const CHECK = process.argv.includes('--check');

const DEFAULT_VERSION = '1.0.0';

/** Get package.json version from repo root. */
async function getPackageVersion() {
  const p = path.join(REPO_ROOT, 'package.json');
  const text = await fs.readFile(p, 'utf8');
  const j = JSON.parse(text);
  if (typeof j.version !== 'string') throw new Error('package.json missing version');
  return j.version;
}

/**
 * Resolve last stable release version: latest git tag vX.Y.Z (no prerelease suffix), or 1.0.0.
 */
function getLastStableVersion() {
  try {
    const out = execSync('git tag -l "v*"', { cwd: REPO_ROOT, encoding: 'utf8' });
    const tags = out
      .split(/\r?\n/)
      .map((t) => t.trim())
      .filter(Boolean);
    // Only stable semver: vX.Y.Z with no hyphen (no -beta, -alpha, etc.)
    const stable = tags.filter((t) => /^v\d+\.\d+\.\d+$/.test(t));
    if (stable.length === 0) return DEFAULT_VERSION;
    const parsed = stable.map((t) => {
      const v = t.slice(1).split('.').map(Number);
      return { tag: t, major: v[0] ?? 0, minor: v[1] ?? 0, patch: v[2] ?? 0 };
    });
    parsed.sort((a, b) =>
      a.major !== b.major ? b.major - a.major : a.minor !== b.minor ? b.minor - a.minor : b.patch - a.patch
    );
    return parsed[0].tag.slice(1);
  } catch {
    return DEFAULT_VERSION;
  }
}

/** Extract version from SKILL.md metadata line: "  version: \"1.0.0\"" */
function getSkillVersionFromContent(content) {
  const m = content.match(/^\s{2}version:\s*["']?([^"'\s]+)["']?\s*$/m);
  return m ? m[1] : null;
}

/** Replace metadata.version line in SKILL.md */
function replaceSkillVersionLine(content, newVersion) {
  return content.replace(/^(\s{2}version:\s*)["']?[^"'\n]*["']?\s*$/m, `$1"${newVersion}"`);
}

/** Extract version from frontmatter at the start of content only (line "version: 1.0.0" or version: "1.0.0"). Ignores --- mid-document (horizontal rules). */
function getKairosVersionFromContent(content) {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith('---')) return null;
  const afterFirst = trimmed.slice(3);
  const second = afterFirst.indexOf('\n---');
  if (second === -1) return null;
  const block = afterFirst.slice(0, second);
  const m = block.match(/^version:\s*["']?([^"'\s\n]+)["']?\s*$/m);
  return m ? m[1] : null;
}

/** Replace version line in frontmatter at the start of content only. Ignores --- mid-document. */
function replaceKairosVersionLine(content, newVersion) {
  const trimmed = content.trimStart();
  const leadingWhitespace = content.slice(0, content.length - trimmed.length);
  if (!trimmed.startsWith('---')) return content;
  const afterFirst = trimmed.slice(3);
  const second = afterFirst.indexOf('\n---');
  if (second === -1) return content;
  const block = afterFirst.slice(0, second);
  const rest = afterFirst.slice(second);
  const newBlock = block.replace(/^(version:\s*)["']?[^"'\n]*["']?\s*$/m, `$1"${newVersion}"\n`);
  return leadingWhitespace + trimmed.slice(0, 3) + newBlock + rest;
}

async function main() {
  const skillsTarget = getLastStableVersion();
  const memTarget = await getPackageVersion();
  const skillDirs = await fs.readdir(SKILLS_DIR, { withFileTypes: true }).then((entries) =>
    entries.filter((e) => e.isDirectory()).map((e) => e.name)
  );

  const mismatches = [];
  const updated = [];

  for (const dir of skillDirs) {
    const skillMdPath = path.join(SKILLS_DIR, dir, 'SKILL.md');
    const kairosPath = path.join(SKILLS_DIR, dir, 'references', 'KAIROS.md');

    // SKILL.md metadata.version -> skillsTarget (last stable)
    try {
      const skillContent = await fs.readFile(skillMdPath, 'utf8');
      const current = getSkillVersionFromContent(skillContent);
      if (current !== null) {
        if (CHECK) {
          if (current !== skillsTarget) mismatches.push(`${dir}/SKILL.md: ${current} (expected ${skillsTarget}, skills=last stable)`);
        } else {
          const newContent = replaceSkillVersionLine(skillContent, skillsTarget);
          if (newContent !== skillContent) {
            await fs.writeFile(skillMdPath, newContent, 'utf8');
            updated.push(`${dir}/SKILL.md`);
          }
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }

    // references/KAIROS.md frontmatter version -> skillsTarget (last stable)
    try {
      const kairosContent = await fs.readFile(kairosPath, 'utf8');
      const current = getKairosVersionFromContent(kairosContent);
      if (current !== null) {
        if (CHECK) {
          if (current !== skillsTarget) mismatches.push(`${dir}/references/KAIROS.md: ${current} (expected ${skillsTarget}, skills=last stable)`);
        } else {
          const newContent = replaceKairosVersionLine(kairosContent, skillsTarget);
          if (newContent !== kairosContent) {
            await fs.writeFile(kairosPath, newContent, 'utf8');
            updated.push(`${dir}/references/KAIROS.md`);
          }
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  // src/embed-docs/mem/*.md frontmatter version -> memTarget (package.json)
  try {
    const memFiles = await fs.readdir(MEM_DIR).then((names) => names.filter((n) => n.endsWith('.md')));
    for (const name of memFiles) {
      const memPath = path.join(MEM_DIR, name);
      const content = await fs.readFile(memPath, 'utf8');
      const current = getKairosVersionFromContent(content);
      if (current !== null) {
        if (CHECK) {
          if (current !== memTarget) mismatches.push(`src/embed-docs/mem/${name}: ${current} (expected ${memTarget}, mem=package.json)`);
        } else {
          const newContent = replaceKairosVersionLine(content, memTarget);
          if (newContent !== content) {
            await fs.writeFile(memPath, newContent, 'utf8');
            updated.push(`src/embed-docs/mem/${name}`);
          }
        }
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  if (CHECK) {
    if (mismatches.length > 0) {
      console.error('Version(s) do not match targets (mem=package.json, skills=last stable):');
      for (const m of mismatches) console.error('  -', m);
      process.exit(1);
    }
    return;
  }

  if (updated.length > 0) {
    console.log('Updated: mem ->', memTarget + ', skills ->', skillsTarget + ':', updated.join(', '));
  }
}

main().catch((err) => {
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});
