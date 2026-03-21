import { QdrantConnection } from './connection.js';
import { validateAndConvertId } from './utils.js';
import { qdrantOperations, qdrantOperationDuration } from '../metrics/qdrant-metrics.js';
import { getTenantId, getSpaceContext, getSearchSpaceIds } from '../../utils/tenant-context.js';
import { buildSpaceFilter } from '../../utils/space-filter.js';
import { KAIROS_APP_SPACE_ID } from '../../config.js';

/**
 * Retrieval helpers
 */

export interface AccessiblePoint {
  id: string;
  payload: any;
  vector?: any;
}

export type PointAccessResult =
  | { status: 'not_found' }
  | { status: 'forbidden'; pointId: string; spaceId: string }
  | { status: 'allowed'; point: AccessiblePoint };

export async function retrievePointAccessById(
  conn: QdrantConnection,
  uuid: string,
  options?: { withVector?: boolean }
): Promise<PointAccessResult> {
  const validatedId = validateAndConvertId(uuid);
  const withVector = options?.withVector ?? false;
  const points = await conn.client.retrieve(conn.collectionName, {
    ids: [validatedId],
    with_payload: true,
    with_vector: withVector
  });
  if (!points || points.length === 0) {
    return { status: 'not_found' };
  }

  const point = points[0];
  if (!point) {
    return { status: 'not_found' };
  }

  const pointSpaceId = String((point.payload as any)?.space_id ?? KAIROS_APP_SPACE_ID);
  const allowed = getSpaceContext().allowedSpaceIds;
  const canRead = allowed.includes(pointSpaceId) || pointSpaceId === KAIROS_APP_SPACE_ID;
  if (!canRead) {
    return { status: 'forbidden', pointId: String(point.id), spaceId: pointSpaceId };
  }

  return {
    status: 'allowed',
    point: {
      id: String(point.id),
      payload: point.payload,
      ...(withVector ? { vector: point.vector } : {})
    }
  };
}

export async function retrieveAccessiblePointById(
  conn: QdrantConnection,
  uuid: string,
  options?: { withVector?: boolean }
): Promise<AccessiblePoint | null> {
  const result = await retrievePointAccessById(conn, uuid, options);
  return result.status === 'allowed' ? result.point : null;
}

export async function retrieveById(conn: QdrantConnection, uuid: string): Promise<{ uuid: string; payload: any } | null> {
  return conn.executeWithReconnect(async () => {
    const tenantId = getTenantId();
    const timer = qdrantOperationDuration.startTimer({ operation: 'retrieve', tenant_id: tenantId });
    
    try {
      const point = await retrieveAccessiblePointById(conn, uuid);
      if (!point) {
        timer({ operation: 'retrieve', tenant_id: tenantId });
        return null;
      }

      qdrantOperations.inc({ 
        operation: 'retrieve', 
        status: 'success',
        tenant_id: tenantId 
      });
      
      timer({ operation: 'retrieve', tenant_id: tenantId });
      return { uuid: point.id, payload: point.payload };
    } catch (error) {
      qdrantOperations.inc({ 
        operation: 'retrieve', 
        status: 'error',
        tenant_id: tenantId 
      });
      timer({ operation: 'retrieve', tenant_id: tenantId });
      throw error;
    }
  });
}

export async function getMemoryByUUID(conn: QdrantConnection, uuid: string): Promise<any | null> {
  return conn.executeWithReconnect(async () => {
    const result = await retrieveById(conn, uuid);
    if (!result) return null;
    const payload = result.payload;
    return {
      id: result.uuid,
      description_short: payload.label || payload.description_short || '',
      description_full: payload.text || payload.description_full || '',
      domain: payload.domain || '',
      task: payload.task || '',
      type: payload.type || 'context',
      tags: payload.tags || [],
      protocol: payload.protocol,
      quality_metrics: payload.quality_metrics,
      quality_metadata: payload.quality_metadata,
      memory_uuid: uuid,
      chain: payload.chain ? {
        id: payload.chain.id,
        label: payload.chain.label,
        step_index: payload.chain.step_index,
        step_count: payload.chain.step_count
      } : undefined,
      embedding: [],
      access_count: payload.quality_metrics?.retrievalCount || 0,
      last_accessed: new Date(payload.updated_at || payload.created_at || Date.now()),
      relevance_score: 1.0,
      created_at: new Date(payload.created_at || Date.now()),
      peak_contexts: [],
      certainty: 0.8,
      entropy: 0.2
    };
  });
}

export async function getChainMemories(conn: QdrantConnection, chainId: string): Promise<Array<{ uuid: string; payload: any }>> {
  return conn.executeWithReconnect(async () => {
    const results: Array<{ uuid: string; payload: any }> = [];
    let offset: any = undefined;
    const filter = buildSpaceFilter(getSearchSpaceIds(), { must: [{ key: 'chain.id', match: { value: chainId } }] });
    do {
      const page = await conn.client.scroll(conn.collectionName, {
        filter,
        with_payload: true,
        with_vector: false,
        limit: 256,
        offset
      } as any);
      (page.points || []).forEach((pt: any) => results.push({ uuid: String(pt.id), payload: pt.payload }));
      offset = page.next_page_offset;
    } while (offset);

    results.sort((a, b) => {
      const ai = typeof a.payload?.chain?.step_index === 'number' ? a.payload.chain.step_index : 0;
      const bi = typeof b.payload?.chain?.step_index === 'number' ? b.payload.chain.step_index : 0;
      return ai - bi;
    });

    return results;
  });
}

/**
 * Find step-1 memory UUID for a protocol slug (exact match), scoped to searchable spaces.
 */
export async function findFirstStepMemoryUuidBySlug(
  conn: QdrantConnection,
  slug: string
): Promise<string | null> {
  return conn.executeWithReconnect(async () => {
    const normalized = (slug || '').trim().toLowerCase();
    if (!normalized) return null;
    const filter = buildSpaceFilter(getSearchSpaceIds(), {
      must: [
        { key: 'slug', match: { value: normalized } },
        { key: 'chain.step_index', match: { value: 1 } }
      ]
    });
    const page = await conn.client.scroll(conn.collectionName, {
      filter,
      limit: 4,
      with_payload: true,
      with_vector: false
    } as any);
    const pts = page.points || [];
    if (pts.length === 0) return null;
    if (pts.length > 1) {
      pts.sort((a: any, b: any) => String(a.id).localeCompare(String(b.id)));
    }
    return String(pts[0]!.id);
  });
}