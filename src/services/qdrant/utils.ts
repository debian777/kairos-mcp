import { v4 as uuidv4 } from 'uuid';
import { KairosError } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

/**
 * Utility helpers extracted from original qdrant.ts
 * Functions are pure / accept service context where necessary.
 */

export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export function convertTestIdToUUID(testId: string): string {
  if (isValidUUID(testId)) return testId;
  const deterministicUUID = uuidv4();
  logger.info(`Converted test ID "${testId}" to UUID: ${deterministicUUID}`);
  return deterministicUUID;
}

export function validateAndConvertId(id: string): string {
  if (!id || typeof id !== 'string') {
    throw new KairosError(
      `Invalid ID format: ${id}. ID must be a non-empty string.`,
      'INVALID_ID_FORMAT',
      400
    );
  }
  const converted = convertTestIdToUUID(id);
  if (!isValidUUID(converted)) {
    throw new KairosError(
      `ID "${id}" could not be converted to a valid UUID.`,
      'INVALID_UUID_FORMAT',
      400
    );
  }
  return converted;
}

export function validatePayload(payload: any): void {
  if (!payload || typeof payload !== 'object') {
    throw new KairosError('Payload must be a valid object', 'INVALID_PAYLOAD_STRUCTURE', 400);
  }
  const requiredFields = ['description_short', 'description_full', 'domain', 'task', 'type'];
  for (const field of requiredFields) {
    if (!(field in payload)) {
      throw new KairosError(`Missing required field: ${field}`, 'MISSING_REQUIRED_FIELD', 400, { missingField: field });
    }
  }
  if (typeof payload.description_short !== 'string' || payload.description_short.trim() === '') {
    throw new KairosError('description_short must be a non-empty string', 'INVALID_FIELD_TYPE', 400);
  }
  if (typeof payload.description_full !== 'string' || payload.description_full.trim() === '') {
    throw new KairosError('description_full must be a non-empty string', 'INVALID_FIELD_TYPE', 400);
  }
  if (typeof payload.domain !== 'string' || payload.domain.trim() === '') {
    throw new KairosError('domain must be a non-empty string', 'INVALID_FIELD_TYPE', 400);
  }
  if (typeof payload.task !== 'string' || payload.task.trim() === '') {
    throw new KairosError('task must be a non-empty string', 'INVALID_FIELD_TYPE', 400);
  }
  if (typeof payload.type !== 'string' || payload.type.trim() === '') {
    throw new KairosError('type must be a non-empty string', 'INVALID_FIELD_TYPE', 400);
  }
  if (payload.tags && !Array.isArray(payload.tags)) {
    throw new KairosError('tags must be an array if provided', 'INVALID_FIELD_TYPE', 400);
  }
  if (payload.protocol && typeof payload.protocol !== 'object') {
    throw new KairosError('protocol must be an object if provided', 'INVALID_FIELD_TYPE', 400);
  }
  if (payload.ai && typeof payload.ai !== 'object') {
    throw new KairosError('ai must be an object if provided', 'INVALID_FIELD_TYPE', 400);
  }
}

export function parseBooleanEnv(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;
  const normalized = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

/**
 * Sanitize points, removing empty vectors and converting root arrays to named vectors.
 * Keep lightweight and delegate upsert to caller.
 */
export function sanitizePoints(points: any[]): any[] {
  return (points || []).map((pt: any) => {
    const newPt = { ...pt };
    const vec = pt.vector;
    if (!vec) return newPt;
    if (Array.isArray(vec)) {
      if (!vec.length) {
        delete newPt.vector;
      } else {
        newPt.vector = { [`vs${vec.length}`]: vec };
      }
      return newPt;
    }
    if (typeof vec === 'object') {
      const filtered: Record<string, any> = {};
      Object.entries(vec).forEach(([k, v]: [string, any]) => {
        if (Array.isArray(v) && v.length > 0) filtered[k] = v;
      });
      if (Object.keys(filtered).length === 0) {
        delete newPt.vector;
      } else {
        newPt.vector = filtered;
      }
      return newPt;
    }
    delete newPt.vector;
    return newPt;
  });
}

/**
 * Upsert points using provided Qdrant client and collection name.
 * This is intentionally small and throws any client error to be handled by caller.
 */
export async function sanitizeAndUpsert(client: any, collectionName: string, points: any[]): Promise<any> {
  const sanitized = sanitizePoints(points);
  logger.debug(`sanitizeAndUpsert: sanitized points count=${sanitized.length}`);
  return await client.upsert(collectionName, { points: sanitized });
}