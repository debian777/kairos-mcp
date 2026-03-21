import type { QdrantService } from '../services/qdrant/service.js';
import type { UpdateInput, UpdateOutput } from './kairos_update_schema.js';

/** Extract BODY from a full KAIROS render if present; otherwise return input as-is */
function extractBody(text: string): string {
    const start = /<!--\s*KAIROS:BODY-START\s*-->/i;
    const end = /<!--\s*KAIROS:BODY-END\s*-->/i;
    const s = text.search(start);
    const e = text.search(end);
    if (s >= 0 && e > s) {
        // slice between the end of start marker and beginning of end marker
        const startMatch = text.match(start);
        if (!startMatch) return text;
        const startIdx = (startMatch.index || 0) + startMatch[0].length;
        return text.slice(startIdx, e).trim();
    }
    return text;
}

/** Shared execute: update memories by URIs. Used by MCP tool and HTTP route. */
export async function executeUpdate(
  qdrantService: QdrantService,
  input: UpdateInput
): Promise<UpdateOutput> {
  const { uris, markdown_doc: markdownDoc, updates } = input;
  if (markdownDoc && markdownDoc.length !== uris.length) {
    throw new Error('markdown_doc array length must match uris array length');
  }
  const results: UpdateOutput['results'] = [];
  let totalUpdated = 0;
  let totalFailed = 0;

  for (let i = 0; i < uris.length; i++) {
    const uri = uris[i]!;
    try {
      const uuid = typeof uri === 'string' ? uri.split('/').pop() : undefined;
      if (!uuid) {
        throw new Error('Invalid URI format');
      }
      const mk = Array.isArray(markdownDoc) ? markdownDoc[i] : undefined;
      if (typeof mk === 'string' && mk.trim().length > 0) {
        const body = extractBody(mk);
        await qdrantService.updateMemory(uuid, { text: body });
      } else if (updates && Object.keys(updates).length > 0) {
        if (typeof updates['text'] === 'string' && updates['text'].indexOf('<!-- KAIROS:BODY-START') !== -1 && updates['text'].indexOf('<!-- KAIROS:BODY-END') !== -1) {
          const body = extractBody(updates['text']);
          await qdrantService.updateMemory(uuid, { text: body });
        } else {
          await qdrantService.updateMemory(uuid, updates);
        }
      } else {
        throw new Error('Provide markdown_doc or updates');
      }
      results.push({
        uri,
        status: 'updated',
        message: `Memory ${uri} updated successfully`
      });
      totalUpdated++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.push({
        uri,
        status: 'error',
        message: `Failed to update memory: ${errorMessage}`
      });
      totalFailed++;
    }
  }

  return {
    results,
    total_updated: totalUpdated,
    total_failed: totalFailed
  };
}
