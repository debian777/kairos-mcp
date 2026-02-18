/**
 * Normalize an incoming markdown blob.
 * Supports both plain markdown strings and JSON-stringified markdown
 * (e.g. produced by JSON.stringify(markdownText)).
 */
export function normalizeMarkdownBlob(text: string): string {
  if (!text) return text;
  const trimmed = text.trim();

  // Heuristic: if it looks like a JSON string literal, try to decode it.
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'string') {
        return parsed;
      }
    } catch {
      // Fall through to return original text
    }
  }

  return text;
}

export interface MarkdownStructure {
  h1: string | null;
  h2Items: string[];
}

export function parseMarkdownStructure(text: string): MarkdownStructure {
  const lines = text.split(/\r?\n/);
  let h1: string | null = null;
  const h2Items: string[] = [];
  let inCodeBlock = false; // Track code block state to avoid interpreting comments as headers

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Toggle code block state when encountering code block delimiters
    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    // Only check for headers when not inside a code block
    if (inCodeBlock) continue;

    // Find H1 header
    if (trimmed.startsWith('# ') && h1 === null) {
      h1 = trimmed.substring(2).trim();
    }
    // Find H2 headers
    else if (trimmed.startsWith('## ')) {
      h2Items.push(trimmed.substring(3).trim());
    }
  }

  return { h1, h2Items };
}

export function generateLabel(text: string): string {
  const lines = text.split(/\r?\n/);
  let candidate = lines.find(line => /^\s*#+\s+/.test(line));
  if (candidate) {
    candidate = candidate.replace(/^\s*#+\s+/, '');
  } else {
    candidate = lines.find(line => line.trim().length > 0) || 'Memory';
  }
  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 120) : 'Memory';
}

export function generateTags(text: string): string[] {
  const label = generateLabel(text).toLowerCase();
  const candidates = new Set<string>();
  label.split(/[^a-z0-9]+/i)
    .map(word => word.trim().toLowerCase())
    .filter(word => word.length > 2)
    .slice(0, 6)
    .forEach(word => candidates.add(word));

  const bulletMatches = text.match(/^\s*[-*+]\s+(.*)$/gm) || [];
  bulletMatches.forEach(line => {
    const words = line.replace(/^\s*[-*+]\s+/, '').split(/[^a-z0-9]+/i);
    words
      .map(word => word.trim().toLowerCase())
      .filter(word => word.length > 3)
      .slice(0, 2)
      .forEach(word => candidates.add(word));
  });

  return Array.from(candidates).slice(0, 8);
}