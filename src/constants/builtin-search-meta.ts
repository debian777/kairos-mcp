import type { Memory } from '../types/memory.js';
import { getMetaDoc } from '../resources/embedded-mcp-resources.js';
import { parseFrontmatter } from '../utils/frontmatter.js';

/** Refine-help protocol; always appended as an **activate** footer choice (not a vector match). */
export const KAIROS_REFINING_PROTOCOL_UUID = '00000000-0000-0000-0000-000000002002';

/** Built-in adapter authoring flow; always appended as an **activate** footer choice (not a vector match). */
export const KAIROS_CREATION_PROTOCOL_UUID = '00000000-0000-0000-0000-000000002001';

function getMetaDocTitle(slug: string, fallbackTitle: string): string {
  const doc = getMetaDoc(slug);
  if (!doc) return fallbackTitle;

  const parsed = parseFrontmatter(doc);
  if (parsed.title && parsed.title.trim().length > 0) {
    return parsed.title.trim();
  }

  const h1Match = parsed.body.match(/^#\s+(.+)$/m);
  if (h1Match && h1Match[1]) {
    return h1Match[1].trim();
  }

  return fallbackTitle;
}

/** Footer labels come from built-in meta docs, not hardcoded strings. */
export const KAIROS_REFINING_FOOTER_LABEL = getMetaDocTitle(
  'refine-search',
  'Get help refining your search'
);
export const KAIROS_CREATION_FOOTER_LABEL = getMetaDocTitle(
  'create-new-protocol',
  'Create New KAIROS Protocol'
);
export const KAIROS_CREATION_FOOTER_NEXT_ACTION =
  'call train with adapter markdown to register a new adapter/protocol/workflow';

/** True if this memory belongs to built-in footer protocols (refine / create). */
export function memoryIsBuiltinSearchFooterProtocol(m: Memory): boolean {
  return (
    m.memory_uuid === KAIROS_REFINING_PROTOCOL_UUID ||
    m.adapter?.id === KAIROS_REFINING_PROTOCOL_UUID ||
    m.memory_uuid === KAIROS_CREATION_PROTOCOL_UUID ||
    m.adapter?.id === KAIROS_CREATION_PROTOCOL_UUID
  );
}
