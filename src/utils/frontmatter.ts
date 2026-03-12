/**
 * Parse YAML-like frontmatter at the start of a markdown document.
 * Content between first --- and second --- is parsed for key: value lines.
 * Returns extracted metadata and the body (rest of document after closing ---).
 */

export interface ParsedFrontmatter {
  version?: string;
  title?: string;
  body: string;
}

const FRONTMATTER_DELIM = '---';

/**
 * Parse frontmatter from the start of text. If no closing --- is found,
 * returns body as the original text and no metadata.
 */
export function parseFrontmatter(text: string): ParsedFrontmatter {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith(FRONTMATTER_DELIM)) {
    return { body: text };
  }

  const afterFirst = trimmed.slice(FRONTMATTER_DELIM.length);
  const secondIndex = afterFirst.indexOf('\n' + FRONTMATTER_DELIM);
  if (secondIndex === -1) {
    return { body: text };
  }

  const fmLines = afterFirst.slice(0, secondIndex).trim().split(/\r?\n/);
  const body = afterFirst.slice(secondIndex + FRONTMATTER_DELIM.length + 1).trimStart();

  const result: ParsedFrontmatter = { body };
  for (const line of fmLines) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key === 'version' && value) result.version = value;
    if (key === 'title' && value) result.title = value;
  }
  return result;
}
