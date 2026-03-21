import type { QdrantService } from '../services/qdrant/service.js';
import type { UpdateInput, UpdateOutput } from './update_schema.js';
import { extractMemoryBody, hasMemoryBodyMarkers } from '../utils/memory-body.js';

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

  for (let index = 0; index < uris.length; index++) {
    const uri = uris[index]!;
    try {
      const uuid = typeof uri === 'string' ? uri.split('/').pop() : undefined;
      if (!uuid) {
        throw new Error('Invalid URI format');
      }
      const markdown = Array.isArray(markdownDoc) ? markdownDoc[index] : undefined;
      if (typeof markdown === 'string' && markdown.trim().length > 0) {
        const body = extractMemoryBody(markdown);
        await qdrantService.updateMemory(uuid, { text: body });
      } else if (updates && Object.keys(updates).length > 0) {
        if (typeof updates['text'] === 'string' && hasMemoryBodyMarkers(updates['text'])) {
          const body = extractMemoryBody(updates['text']);
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
