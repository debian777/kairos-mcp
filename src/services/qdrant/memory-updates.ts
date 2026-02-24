import { QdrantConnection } from './connection.js';
import { retrieveById } from './memory-retrieval.js';
import { embeddingService } from '../embedding/service.js';
import { sanitizeAndUpsert, validateAndConvertId } from './utils.js';
import { redisCacheService } from '../redis-cache.js';
import { logger } from '../../utils/logger.js';
import { KairosError } from '../../types/index.js';
import { qdrantOperations, qdrantOperationDuration, qdrantUpsertDuration } from '../metrics/qdrant-metrics.js';
import { getTenantId, getSpaceContext } from '../../utils/tenant-context.js';
import { KAIROS_APP_SPACE_ID } from '../../config.js';

/**
 * Update memory by UUID (for protocol reconstruction) and general update/delete
 */

export async function updateMemoryByUUID(conn: QdrantConnection, uuid: string, updates: any): Promise<void> {
  return conn.executeWithReconnect(async () => {
    const tenantId = getTenantId();
    const timer = qdrantUpsertDuration.startTimer({ tenant_id: tenantId });
    
    try {
      const existing = await retrieveById(conn, uuid);
    if (!existing) {
      throw new KairosError(`Memory with UUID ${uuid} not found`, 'MEMORY_NOT_FOUND', 404);
    }

    const updatedAi = { ...(existing.payload.ai || {}), ...((updates.ai || {}) as any), ...(updates.memory_uuid !== undefined ? { memory_uuid: updates.memory_uuid } : {}) };

    const defaultSpaceId = getSpaceContext().defaultWriteSpaceId;
    const memoryPayload = {
      ...existing.payload,
      space_id: (existing.payload as any).space_id ?? defaultSpaceId,
      ...(updates.description_short && { description_short: updates.description_short }),
      ...(updates.description_full && { description_full: updates.description_full }),
      ...(updates.domain && { domain: updates.domain }),
      ...(updates.task && { task: updates.task }),
      ...(updates.type && { type: updates.type }),
      ...(updates.tags && { tags: updates.tags }),
      ai: updatedAi,
      updated_at: new Date().toISOString()
    };

    let vector: number[] = [];
    let existingVectorObj: any;
    try {
      const resultWithVector = await conn.client.retrieve(conn.collectionName, { ids: [uuid], with_payload: true, with_vector: true });
      if (resultWithVector && resultWithVector[0]) {
        existingVectorObj = resultWithVector[0].vector;
        if (Array.isArray(existingVectorObj)) vector = existingVectorObj as number[];
        else if (existingVectorObj && typeof existingVectorObj === 'object') {
          const firstKey = Object.keys(existingVectorObj || {})[0];
          if (firstKey && Array.isArray(existingVectorObj[firstKey])) vector = existingVectorObj[firstKey] as number[];
        }
      }
    } catch { existingVectorObj = undefined; }

    if (updates.description_full && updates.description_full !== existing.payload.description_full) {
      const embeddingResult = await embeddingService.generateEmbedding(updates.description_full);
      vector = embeddingResult.embedding;
    }

    const upsertPoint: any = { id: uuid, payload: memoryPayload };
    if (Array.isArray(vector) && vector.length > 0) {
      const currentVectorName = `vs${vector.length}`;
      upsertPoint.vector = { [currentVectorName]: vector };
    } else if (existingVectorObj) {
      upsertPoint.vector = existingVectorObj;
    }

    logger.debug(`updateMemoryByUUID: upsertPoint vector keys=${Object.keys(upsertPoint.vector || {}).join(',')}`);
    await sanitizeAndUpsert(conn.client, conn.collectionName, [upsertPoint]);
    
    // Invalidate cache after update (publishes invalidation events internally)
    await redisCacheService.invalidateMemoryCache(uuid);
    await redisCacheService.invalidateSearchCache();
    
    qdrantOperations.inc({ 
      operation: 'update', 
      status: 'success',
      tenant_id: tenantId 
    });
    
    timer({ tenant_id: tenantId });
    } catch (error) {
      qdrantOperations.inc({ 
        operation: 'update', 
        status: 'error',
        tenant_id: tenantId 
      });
      timer({ tenant_id: tenantId });
      throw error;
    }
  });
}

export async function updateMemory(conn: QdrantConnection, id: string, updates: any): Promise<void> {
  return conn.executeWithReconnect(async () => {
    const tenantId = getTenantId();
    const timer = qdrantUpsertDuration.startTimer({ tenant_id: tenantId });
    
    try {
      const validatedId = validateAndConvertId(id);
    const retrieveResult = await conn.client.retrieve(conn.collectionName, { ids: [validatedId], with_payload: true, with_vector: true });
    if (!retrieveResult || retrieveResult.length === 0) {
      throw new KairosError(`Memory with ID ${id} not found`, 'MEMORY_NOT_FOUND', 404);
    }
    const existingPoint = retrieveResult[0]!;
    const existingPayload = existingPoint.payload as any;
    const pointSpaceId = existingPayload?.space_id ?? KAIROS_APP_SPACE_ID;
    if (!getSpaceContext().allowedSpaceIds.includes(pointSpaceId)) {
      throw new KairosError(`Memory with ID ${id} not found`, 'MEMORY_NOT_FOUND', 404);
    }

    let newQualityMetadata = existingPayload.quality_metadata;
    const shouldRecalculateQuality = updates.description_short || updates.description_full || updates.domain || updates.task || updates.type || updates.tags;
    if (shouldRecalculateQuality) {
      const { modelStats } = await import('../stats/model-stats.js');
      const qualityMetadata = modelStats.calculateStepQualityMetadata(
        updates.description_short || existingPayload.description_short || '',
        updates.domain || existingPayload.domain || 'general',
        updates.task || existingPayload.task || 'general-task',
        updates.type || existingPayload.type || 'context',
        updates.tags || existingPayload.tags || []
      );
      newQualityMetadata = {
        step_quality_score: qualityMetadata.step_quality_score,
        step_quality: qualityMetadata.step_quality
      };
    }

    const defaultSpaceId = getSpaceContext().defaultWriteSpaceId;
    const updatedPayload = {
      ...existingPayload,
      space_id: existingPayload.space_id ?? defaultSpaceId,
      ...updates,
      updated_at: new Date().toISOString(),
      quality_metadata: newQualityMetadata
    };

    let vector: number[] = [];
    let existingVectorObj: any = undefined;
    if (existingPoint.vector) {
      existingVectorObj = existingPoint.vector;
      if (Array.isArray(existingPoint.vector)) vector = existingPoint.vector as number[];
      else if (typeof existingPoint.vector === 'object') {
        const fname = Object.keys(existingPoint.vector || {})[0];
        if (fname && Array.isArray((existingPoint.vector as any)[fname])) vector = (existingPoint.vector as any)[fname] as number[];
      }
    }

    const textChanged = typeof (updates as any).text === 'string' && (updates as any).text !== existingPayload.text;
    const fullChanged = typeof updates.description_full === 'string' && updates.description_full !== existingPayload.description_full;
    if (textChanged || fullChanged) {
      const source = textChanged ? (updates as any).text : updates.description_full as string;
      const embeddingResult = await embeddingService.generateEmbedding(source);
      vector = embeddingResult.embedding;
    }

    const upsertPoint2: any = { id: validatedId, payload: updatedPayload };
    if (Array.isArray(vector) && vector.length > 0) {
      const currentVectorName = `vs${vector.length}`;
      upsertPoint2.vector = { [currentVectorName]: vector };
    } else if (existingVectorObj) {
      upsertPoint2.vector = existingVectorObj;
    }

    logger.debug(`updateMemory: upsertPoint2 vector keys=${Object.keys(upsertPoint2.vector || {}).join(',')}`);
    await sanitizeAndUpsert(conn.client, conn.collectionName, [upsertPoint2]);

    // Invalidate cache after update (publishes invalidation events internally)
    await redisCacheService.invalidateMemoryCache(validatedId);
    await redisCacheService.invalidateSearchCache();
    
    qdrantOperations.inc({ 
      operation: 'update', 
      status: 'success',
      tenant_id: tenantId 
    });
    
    timer({ tenant_id: tenantId });
    } catch (error) {
      qdrantOperations.inc({ 
        operation: 'update', 
        status: 'error',
        tenant_id: tenantId 
      });
      timer({ tenant_id: tenantId });
      throw error;
    }
  });
}

export async function deleteMemory(conn: QdrantConnection, id: string): Promise<void> {
  return conn.executeWithReconnect(async () => {
    const tenantId = getTenantId();
    const timer = qdrantOperationDuration.startTimer({ operation: 'delete', tenant_id: tenantId });

    try {
      const validatedId = validateAndConvertId(id);
      const existing = await retrieveById(conn, validatedId);
      if (!existing) {
        throw new KairosError(`Memory with ID ${id} not found`, 'MEMORY_NOT_FOUND', 404);
      }
      await conn.client.delete(conn.collectionName, { points: [validatedId] });
      
      // Invalidate cache after deletion (publishes invalidation events internally)
      await redisCacheService.invalidateMemoryCache(validatedId);
      await redisCacheService.invalidateSearchCache();
      
      qdrantOperations.inc({ 
        operation: 'delete', 
        status: 'success',
        tenant_id: tenantId 
      });
      
      timer({ operation: 'delete', tenant_id: tenantId });
    } catch (error) {
      qdrantOperations.inc({ 
        operation: 'delete', 
        status: 'error',
        tenant_id: tenantId 
      });
      timer({ operation: 'delete', tenant_id: tenantId });
      throw error;
    }
  });
}

// Ensure named exports are explicitly available