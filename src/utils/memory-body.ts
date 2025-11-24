/**
 * Extracts the markdown body stored between KAIROS BODY markers.
 * Falls back to the original text if markers are missing.
 */
export function extractMemoryBody(text?: string | null): string {
  if (!text) return '';

  const start = /<!--\s*KAIROS:BODY-START\s*-->/i;
  const end = /<!--\s*KAIROS:BODY-END\s*-->/i;
  const startMatch = text.match(start);
  const endIndex = text.search(end);

  if (!startMatch || endIndex === -1) {
    return text.trim();
  }

  const startIndex = (startMatch.index ?? 0) + startMatch[0].length;
  if (endIndex <= startIndex) {
    return text.trim();
  }

  return text.slice(startIndex, endIndex).trim();
}

