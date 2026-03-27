import { QdrantConnection } from './connection.js';
import { validateAndConvertId } from './utils.js';
import { qdrantOperations, qdrantOperationDuration } from '../metrics/qdrant-metrics.js';
import { getTenantId, getSpaceContext, getSearchSpaceIds } from '../../utils/tenant-context.js';
import { buildAdapterSiblingScrollFilter, buildSpaceFilter } from '../../utils/space-filter.js';
import { KAIROS_APP_SPACE_ID } from '../../config.js';
import { structuredLogger } from '../../utils/structured-logger.js';

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
      label: payload.label || '',
      text: payload.text || '',
      domain: payload.domain || '',
      task: payload.task || '',
      type: payload.type || 'context',
      tags: payload.tags || [],
      protocol: payload.protocol,
      quality_metrics: payload.quality_metrics,
      quality_metadata: payload.quality_metadata,
      memory_uuid: uuid,
      adapter: payload.adapter ? {
        id: payload.adapter.id,
        name: payload.adapter.name,
        layer_index: payload.adapter.layer_index,
        layer_count: payload.adapter.layer_count,
        ...(typeof payload.adapter.protocol_version === 'string' && {
          protocol_version: payload.adapter.protocol_version
        }),
        ...(Array.isArray(payload.adapter.activation_patterns) && {
          activation_patterns: payload.adapter.activation_patterns
        })
      } : undefined,
      inference_contract: payload.inference_contract,
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

export async function getAdapterLayers(
  conn: QdrantConnection,
  adapterId: string,
  allowedSpaceIdsOverride?: string[]
): Promise<Array<{ uuid: string; payload: any }>> {
  return conn.executeWithReconnect(async () => {
    const results: Array<{ uuid: string; payload: any }> = [];
    let offset: any = undefined;
    const spaceIds =
      allowedSpaceIdsOverride && allowedSpaceIdsOverride.length > 0
        ? allowedSpaceIdsOverride
        : getSearchSpaceIds();
    const filter = buildAdapterSiblingScrollFilter(spaceIds, adapterId);
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
      const ai = typeof a.payload?.adapter?.layer_index === 'number'
        ? a.payload.adapter.layer_index
        : 0;
      const bi = typeof b.payload?.adapter?.layer_index === 'number'
        ? b.payload.adapter.layer_index
        : 0;
      return ai - bi;
    });

    return results;
  });
}

/** Result of resolving an adapter slug to an entry-layer point id. */
export interface SlugResolveOutcome {
  layerUuid: string | null;
  /** Present when multiple adapters shared the slug; client should prefer explicit adapter URIs. */
  disambiguation_note?: string;
}

/**
 * Find the first adapter layer UUID for a protocol slug (exact match), scoped to searchable spaces.
 * Paginates scroll so matches are not truncated at a small limit.
 * If the slug maps to more than one adapter, picks deterministically: default write space first, then
 * lowest point id; logs and returns a disambiguation_note instead of failing the request.
 */
export async function findFirstStepMemoryUuidBySlug(
  conn: QdrantConnection,
  slug: string
): Promise<SlugResolveOutcome> {
  return conn.executeWithReconnect(async () => {
    const normalized = (slug || '').trim().toLowerCase();
    if (!normalized) return { layerUuid: null };
    const filter = buildSpaceFilter(getSearchSpaceIds(), {
      must: [
        { key: 'slug', match: { value: normalized } },
        { key: 'adapter.layer_index', match: { value: 1 } }
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

    if (allPts.length === 0) return { layerUuid: null };

    allPts.sort((a: any, b: any) => String(a.id).localeCompare(String(b.id)));

    const byAdapterId = new Map<string, any>();
    for (const p of allPts) {
      const adapterId =
        typeof p.payload?.adapter?.id === 'string'
          ? p.payload.adapter.id
          : `__orphan_${String(p.id)}`;
      if (!byAdapterId.has(adapterId)) byAdapterId.set(adapterId, p);
    }

    const unique = [...byAdapterId.values()];
    if (unique.length === 1) {
      return { layerUuid: String(unique[0]!.id) };
    }

    const defaultWrite = getSpaceContext().defaultWriteSpaceId;
    const spaceOf = (p: any) => String(p.payload?.space_id ?? KAIROS_APP_SPACE_ID);
    const sorted = [...unique].sort((a: any, b: any) => {
      const aDef = spaceOf(a) === defaultWrite ? 0 : 1;
      const bDef = spaceOf(b) === defaultWrite ? 0 : 1;
      if (aDef !== bDef) return aDef - bDef;
      return String(a.id).localeCompare(String(b.id));
    });
    const winner = sorted[0]!;
    const chosenId = String(winner.id);
    const adapterHint =
      typeof winner.payload?.adapter?.id === 'string'
        ? winner.payload.adapter.id
        : chosenId;
    const note = `Slug "${normalized}" matched ${unique.length} adapters; selected one deterministically (default write space preferred, then stable id). Prefer an explicit adapter URI such as kairos://adapter/${adapterHint} to avoid ambiguity.`;
    structuredLogger.warn(`[slug-resolve] ${note}`);
    return { layerUuid: chosenId, disambiguation_note: note };
  });
}