import { QdrantConnection } from './connection.js';
import { validateAndConvertId } from './utils.js';
import { qdrantOperations, qdrantOperationDuration } from '../metrics/qdrant-metrics.js';
import { getTenantId, getSpaceContext, getSearchSpaceIds } from '../../utils/tenant-context.js';
import { buildChainSiblingScrollFilter, buildSpaceFilter } from '../../utils/space-filter.js';
import { KAIROS_APP_SPACE_ID } from '../../config.js';
import { KairosError } from '../../types/index.js';

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

function mergeSpaceIdsForChainScroll(extraSpaceIds?: string[]): string[] {
  const base = getSearchSpaceIds();
  const seen = new Set(base);
  const out = [...base];
  for (const raw of extraSpaceIds ?? []) {
    const id = typeof raw === 'string' ? raw.trim() : '';
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/**
 * Scroll chain members by chain.id, scoped to search spaces plus optional anchor spaces.
 * `extraSpaceIds` should come only from a Memory.space_id the caller already loaded via authorized retrieve
 * (never from raw client input), so sibling resolution matches the same tenant rows as the anchor point.
 */
export async function getChainMemories(
  conn: QdrantConnection,
  chainId: string,
  extraSpaceIds?: string[]
): Promise<Array<{ uuid: string; payload: any }>> {
  return conn.executeWithReconnect(async () => {
    const results: Array<{ uuid: string; payload: any }> = [];
    let offset: any = undefined;
    const filter = buildChainSiblingScrollFilter(mergeSpaceIdsForChainScroll(extraSpaceIds), chainId);
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
 * Paginates scroll so matches are not truncated at a small limit.
 * If the slug maps to more than one chain, prefers the default write space; otherwise throws.
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

    const allPts: any[] = [];
    let offset: any = undefined;
    do {
      const page = await conn.client.scroll(conn.collectionName, {
        filter,
        limit: 64,
        offset,
        with_payload: true,
        with_vector: false
      } as any);
      const pts = page.points || [];
      allPts.push(...pts);
      offset = page.next_page_offset;
    } while (offset);

    if (allPts.length === 0) return null;

    allPts.sort((a: any, b: any) => String(a.id).localeCompare(String(b.id)));

    const byChainId = new Map<string, any>();
    for (const p of allPts) {
      const chainObj = p.payload?.chain as { id?: string } | undefined;
      const chainId =
        chainObj?.id && typeof chainObj.id === 'string' ? chainObj.id : `__orphan_${String(p.id)}`;
      if (!byChainId.has(chainId)) byChainId.set(chainId, p);
    }

    const unique = [...byChainId.values()];
    if (unique.length === 1) {
      return String(unique[0]!.id);
    }

    const defaultWrite = getSpaceContext().defaultWriteSpaceId;
    const spaceOf = (p: any) => String(p.payload?.space_id ?? KAIROS_APP_SPACE_ID);
    const inDefault = unique.filter((p) => spaceOf(p) === defaultWrite);

    if (inDefault.length === 1) {
      return String(inDefault[0]!.id);
    }

    if (inDefault.length > 1) {
      throw new KairosError(
        `Protocol slug "${normalized}" matches more than one protocol in your default space.`,
        'PROTOCOL_KEY_AMBIGUOUS',
        409,
        { key: normalized, chain_count: inDefault.length }
      );
    }

    throw new KairosError(
      `Protocol slug "${normalized}" matches protocols in multiple spaces; use a URI or narrow the active space.`,
      'PROTOCOL_KEY_AMBIGUOUS',
      409,
      {
        key: normalized,
        must_obey: true,
        next_action:
          'Use kairos_begin with uri for the specific protocol, or work in a single target space.',
        spaces: [...new Set(unique.map((p) => spaceOf(p)))]
      }
    );
  });
}