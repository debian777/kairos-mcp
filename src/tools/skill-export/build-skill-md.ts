/**
 * Build SKILL.md text with skill-style YAML frontmatter + protocol body.
 */

import type { DerivedSkillMetadata } from './derive-metadata.js';
import { stripLeadingFrontmatter } from './derive-metadata.js';

function escapeYamlScalar(s: string): string {
  if (/[:#\n\r]|^\s|\s$/.test(s) || s.includes("'")) {
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return s;
}

/**
 * Assemble final SKILL.md for export (proof-of-work blocks preserved in body).
 */
export function buildSkillMdFile(meta: DerivedSkillMetadata, protocolMarkdownNormalized: string): string {
  const body = stripLeadingFrontmatter(protocolMarkdownNormalized).trim();
  const header = `---\nname: ${escapeYamlScalar(meta.name)}\ndescription: ${escapeYamlScalar(meta.description)}\n---\n\n`;
  return `${header}${body}\n`;
}
