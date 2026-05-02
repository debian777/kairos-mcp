/**
 * Per-skill GNU-style SHA256SUMS (paths relative to `<slug>/` in the ZIP).
 * The checksums file does not list itself (same convention as `sha256sum *.md > SHA256SUMS`).
 */

import type { SkillExportFile, SkillExportItem } from './types.js';
import { sha256Hex } from './sha256.js';

export const SKILL_EXPORT_SHA256_SUMS_FILENAME = 'SHA256SUMS';

/**
 * Build `SHA256SUMS` body: one `<hex><space><space><relative path>` line per file,
 * sorted by path. Excludes {@link SKILL_EXPORT_SHA256_SUMS_FILENAME} if present.
 */
export function buildSha256SumsContent(files: readonly SkillExportFile[]): string {
  const lines = files
    .filter((f) => f.path !== SKILL_EXPORT_SHA256_SUMS_FILENAME)
    .map((f) => ({ path: f.path, sha256: f.sha256 }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  if (lines.length === 0) {
    return '';
  }
  return `${lines.map((e) => `${e.sha256}  ${e.path}`).join('\n')}\n`;
}

/** Append `SHA256SUMS` to the skill item’s file list (after SKILL.md and artifacts). */
export function appendSha256SumsToSkillExportItem(item: SkillExportItem): SkillExportItem {
  const content = buildSha256SumsContent(item.files);
  const sumsFile: SkillExportFile = {
    path: SKILL_EXPORT_SHA256_SUMS_FILENAME,
    content,
    contentType: 'text/plain',
    sha256: sha256Hex(content)
  };
  return { ...item, files: [...item.files, sumsFile] };
}
