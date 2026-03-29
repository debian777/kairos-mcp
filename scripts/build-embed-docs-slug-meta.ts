/**
 * Slug extraction and meta markdown collection for build-embed-docs.ts
 */
import * as fs from 'fs';
import * as path from 'path';

type LogFn = (...args: unknown[]) => void;

/** Parse YAML frontmatter for `slug:` (first document block only). */
export function extractSlugFromMarkdown(content: string): string | null {
  const t = content.trimStart();
  if (!t.startsWith('---')) return null;
  const close = t.indexOf('\n---', 3);
  if (close === -1) return null;
  const fm = t.slice(3, close);
  const m = fm.match(/^\s*slug:\s*([^\n\r#]+?)\s*$/m);
  if (!m) return null;
  let s = m[1]!.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }
  return s || null;
}

export function collectMetaBySlug(
  dir: string,
  baseDir: string,
  meta: Record<string, string>,
  label: string,
  readMarkdown: (filePath: string) => string,
  log: { info: LogFn; warn: LogFn }
): void {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    if (entry.name.toLowerCase() === 'readme.md') continue;
    const fullPath = path.join(dir, entry.name);
    const content = readMarkdown(fullPath);
    const slug = extractSlugFromMarkdown(content);
    if (!slug) {
      log.warn(`[meta/${label}] skip (no slug:): ${path.relative(baseDir, fullPath)}`);
      continue;
    }
    if (meta[slug]) {
      log.warn(`[meta/${label}] slug "${slug}" overwritten by ${entry.name}`);
    }
    meta[slug] = content;
    log.info(`[meta] ${slug} <- ${path.relative(baseDir, fullPath)}`);
  }
}
