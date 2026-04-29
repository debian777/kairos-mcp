import type { QdrantService } from '../services/qdrant/service.js';
import type { UpdateInput, UpdateOutput } from './update_schema.js';
import { extractMemoryBody, hasMemoryBodyMarkers } from '../utils/memory-body.js';

/** Shared execute: update memories by URIs. Used by MCP tool and HTTP route. */
export async function executeUpdate(
  qdrantService: QdrantService,
  input: UpdateInput
): Promise<UpdateOutput> {
  const { uris, content, updates } = input;
  if (content && content.length !== uris.length) {
    throw new Error('content array length must match uris array length');
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
      const valueAtIndex = Array.isArray(content) ? content[index] : undefined;
      if (typeof valueAtIndex === 'string' && valueAtIndex.trim().length > 0) {
        const body = extractMemoryBody(valueAtIndex);
        await qdrantService.updateMemory(uuid, { text: body });
      } else if (updates && Object.keys(updates).length > 0) {
        if (typeof updates['text'] === 'string' && hasMemoryBodyMarkers(updates['text'])) {
          const body = extractMemoryBody(updates['text']);
          await qdrantService.updateMemory(uuid, { text: body });
        } else {
          await qdrantService.updateMemory(uuid, updates);
        }
      } else {
        throw new Error('Provide content or updates');
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
