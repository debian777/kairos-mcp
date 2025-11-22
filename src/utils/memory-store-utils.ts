import type { Memory } from '../types/memory.js';

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

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

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

/**
 * Detect if a search query appears to be code-related
 */
export function detectCodeQuery(query: string): boolean {
  const codeIndicators = [
    /\b(function|class|const|let|var|def|import|from|interface|type)\b/i,
    /\b[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/, // Function calls
    /\b[a-zA-Z_$][a-zA-Z0-9_$]*\./, // Method calls
    /\.[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/, // Method calls with dot
    /\b(console\.|log\(|error\()/i, // Common code patterns
    /\b=>|->|\{|\}|\[|\]/, // Language constructs
  ];

  return codeIndicators.some(pattern => pattern.test(query));
}

/**
 * Check if a tag appears to be a code identifier
 */
export function isCodeIdentifier(tag: string): boolean {
  // Code identifiers typically:
  // - Are camelCase, PascalCase, or snake_case
  // - Don't contain spaces
  // - Are not common English words
  // - May contain underscores, dollars, or numbers (but not start with number)

  if (tag.includes(' ') || /^\d/.test(tag)) {
    return false;
  }

  // Check for common programming patterns
  const codePatterns = [
    /[a-z]+[A-Z]/, // camelCase
    /[A-Z][a-z]+/, // PascalCase
    /[a-z]+_[a-z]+/, // snake_case
    /\$[a-zA-Z]/, // $ prefix
    /[a-zA-Z]\$/, // $ suffix
  ];

  return codePatterns.some(pattern => pattern.test(tag)) ||
         tag.length >= 3 && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(tag);
}

export function scoreMemory(memory: Memory, normalizedQuery: string): number {
  const label = memory.label.toLowerCase();
  const text = memory.text.toLowerCase();
  const tags = memory.tags.map(tag => tag.toLowerCase());

  let score = 0;

  // Detect if query appears to be code-related
  const isCodeQuery = detectCodeQuery(normalizedQuery);

  // 1. Exact phrase match (highest weight)
  if (label.includes(normalizedQuery)) {
    score += 300;
  }
  if (text.includes(normalizedQuery)) {
    score += 200;
  }

  // 2. Tag matches
  const tagMatches = tags.filter(tag => tag.includes(normalizedQuery) || normalizedQuery.includes(tag));
  score += tagMatches.length * 150;

  // 3. Code identifier boost for code-related queries
  if (isCodeQuery) {
    const codeIdentifierMatches = tags.filter(tag =>
      isCodeIdentifier(tag) && (tag.includes(normalizedQuery) || normalizedQuery.includes(tag))
    );
    score += codeIdentifierMatches.length * 100; // Additional boost for code identifiers

    // Boost if memory contains code blocks and query is code-related
    if (text.includes('```') || text.includes('[code_identifiers:')) {
      score += 50;
    }
  }

  // 4. Word-level matching with TF-IDF-like scoring
  const queryWords = normalizedQuery.split(/\s+/).filter(word => word.length > 2);
  if (queryWords.length > 0) {
    const labelWords = label.split(/\s+/);
    const textWords = text.split(/\s+/);

    // Calculate term frequency in label and text
    let wordMatchScore = 0;
    for (const queryWord of queryWords) {
      // Exact word matches in label
      const labelExactMatches = labelWords.filter(word => word === queryWord).length;
      wordMatchScore += labelExactMatches * 50;

      // Partial word matches in label
      const labelPartialMatches = labelWords.filter(word => word.includes(queryWord) || queryWord.includes(word)).length;
      wordMatchScore += (labelPartialMatches - labelExactMatches) * 25;

      // Exact word matches in text
      const textExactMatches = textWords.filter(word => word === queryWord).length;
      wordMatchScore += textExactMatches * 30;

      // Partial word matches in text
      const textPartialMatches = textWords.filter(word => word.includes(queryWord) || queryWord.includes(word)).length;
      wordMatchScore += (textPartialMatches - textExactMatches) * 15;
    }

    // Normalize by query length to prevent bias toward longer queries
    wordMatchScore = wordMatchScore / Math.sqrt(queryWords.length);
    score += wordMatchScore;
  }

  // 5. Content quality factors
  // Prefer memories with more structured content (headers, lists)
  const hasHeaders = /^#+\s/.test(memory.text);
  const hasLists = /^[-*+]\s/m.test(memory.text);
  const contentLength = memory.text.length;

  if (hasHeaders) score += 20;
  if (hasLists) score += 15;

  // Length bonus (sweet spot around 500-2000 chars)
  if (contentLength > 200 && contentLength < 3000) {
    score += Math.min(contentLength / 100, 50);
  }

  // 6. Recency bonus (newer content slightly preferred)
  const ageInDays = (Date.now() - new Date(memory.created_at).getTime()) / (1000 * 60 * 60 * 24);
  if (ageInDays < 30) {
    score += Math.max(0, 10 - ageInDays);
  }

  // Normalize score to 0-1 range for consistency
  return Math.min(score / 500, 1.0);
}