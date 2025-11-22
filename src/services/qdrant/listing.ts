import { QdrantConnection } from './connection.js';
import { logger } from '../../utils/logger.js';

/**
 * Listing helpers: listItemsByCategory, getDomainOverview
 */

export async function listItemsByCategory(conn: QdrantConnection, domain: string, type: string, task: string) {
  return conn.executeWithReconnect(async () => {
    const result = await conn.client.scroll(conn.collectionName, {
      filter: {
        must: [
          { key: 'domain', match: { value: domain } },
          { key: 'type', match: { value: type } },
          { key: 'task', match: { value: task } }
        ]
      },
      limit: 100,
      with_payload: true,
      with_vector: false
    });

    if (!result.points) return [];

    return result.points.map((point: any) => {
      const payload = point.payload as any;
      return {
        id: point.id.toString(),
        description_short: payload.description_short || 'No description',
        description_full: payload.description_full || '',
        domain: payload.domain,
        task: payload.task,
        type: payload.type,
        tags: payload.tags || [],
        protocol: payload.protocol,
        uri: payload.uri,
        created_at: payload.created_at || new Date().toISOString()
      };
    });
  });
}

export async function getDomainOverview(conn: QdrantConnection, domain: string) {
  return conn.executeWithReconnect(async () => {
    try {
      const countResult = await conn.client.scroll(conn.collectionName, {
        filter: { must: [{ key: 'domain', match: { value: domain } }] },
        limit: 100,
        with_payload: true,
        with_vector: false
      });

      const points = countResult.points || [];
      const totalMemories = points.length;

      const tagCounts = new Map<string, number>();
      const recentMemoriesData: Array<{ id: string; description: string; created_at: string; timestamp: number }> = [];

      for (const point of points) {
        const payload = point.payload as any;
        if (payload.tags && Array.isArray(payload.tags)) {
          for (const tag of payload.tags) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
        recentMemoriesData.push({
          id: point.id.toString(),
          description: payload.description_short || 'No description',
          created_at: payload.created_at || new Date().toISOString(),
          timestamp: new Date(payload.created_at || Date.now()).getTime()
        });
      }

      const topCategories = Array.from(tagCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag]) => tag);

      const recentMemories = recentMemoriesData
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 5)
        .map(({ id, description, created_at }) => ({ id, description, created_at }));

      return {
        total_memories: totalMemories,
        top_categories: topCategories.length > 0 ? topCategories : ['No categories found'],
        recent_memories: recentMemories.length > 0 ? recentMemories : []
      };
    } catch (error) {
      logger.warn(`getDomainOverview error for domain ${domain}: ${error instanceof Error ? error.message : String(error)}`);
      return { total_memories: 0, top_categories: [], recent_memories: [] };
    }
  });
}