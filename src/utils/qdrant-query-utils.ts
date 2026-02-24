import { QdrantClient } from '@qdrant/js-client-rest';
import { getSpaceContext } from './tenant-context.js';
import { buildSpaceFilter } from './space-filter.js';

/**
 * Count points that have the specified named vector present (non-null)
 */
export async function countPointsWithVector(client: QdrantClient, collectionName: string, vectorName: string): Promise<number> {
  const filter = buildSpaceFilter(getSpaceContext().allowedSpaceIds);
  let offset: any = undefined;
  let count = 0;
  do {
    const page = await client.scroll(collectionName, { filter, with_payload: false, with_vector: [vectorName], limit: 256, offset } as any);
    if (!page?.points || page.points.length === 0) break;
    for (const p of page.points) {
      if (p?.vector && (p.vector as any)[vectorName]) {
        count += 1;
      }
    }
    offset = page.next_page_offset;
  } while (offset);
  return count;
}