/**
 * List unique adapter URIs in a space for bulk export (markdown protocol layers).
 */

import type { MemoryQdrantStore } from '../../services/memory/store.js';
import { buildSpaceFilter } from '../../utils/space-filter.js';

const SCROLL_LIMIT = 512;

/**
 * Return `kairos://adapter/{uuid}` for each distinct adapter in the space (markdown layers).
 */
export async function listAdapterUrisInSpace(memoryStore: MemoryQdrantStore, spaceId: string): Promise<string[]> {
  const { client, collection } = memoryStore.getQdrantAccess();
  const filter = {
    must: [
      ...buildSpaceFilter([spaceId]).must,
      { key: 'content_type', match: { value: 'text/markdown' } }
    ]
  };
  const seen = new Set<string>();
  const uris: string[] = [];
  let offset: string | number | undefined;
  do {
    const page = await client.scroll(collection, {
      filter,
      limit: SCROLL_LIMIT,
      ...(offset !== undefined ? { offset } : {}),
      with_payload: true,
      with_vector: false
    });
    const points = Array.isArray(page?.points) ? page.points : [];
    for (const point of points) {
      const payload = (point?.payload ?? {}) as Record<string, unknown>;
      const adapter = payload['adapter'] as { id?: string } | undefined;
      const id = typeof adapter?.id === 'string' && adapter.id.trim().length > 0 ? adapter.id.trim() : '';
      if (!id || seen.has(id)) continue;
      seen.add(id);
      uris.push(`kairos://adapter/${id}`);
    }
    const nextOffset = page?.next_page_offset;
    offset = typeof nextOffset === 'string' || typeof nextOffset === 'number' ? nextOffset : undefined;
  } while (offset !== null && offset !== undefined);

  return uris;
}
