/**
 * Space and tenant context for multitenancy.
 * SpaceContext is derived from Keycloak (sub + groups); getTenantId() remains for metrics.
 * AsyncLocalStorage allows Redis and other services to get current space without request reference.
 */

import { AsyncLocalStorage } from 'async_hooks';
import { AUTH_ENABLED, DEFAULT_SPACE_ID } from '../config.js';

export interface SpaceContext {
  userId: string;
  groupIds: string[];
  allowedSpaceIds: string[];
  defaultWriteSpaceId: string;
}

const spaceStorage = new AsyncLocalStorage<SpaceContext>();

function defaultSpaceContext(): SpaceContext {
  const spaceId = DEFAULT_SPACE_ID || 'space:default';
  return {
    userId: '',
    groupIds: [],
    allowedSpaceIds: [spaceId],
    defaultWriteSpaceId: spaceId
  };
}

/**
 * Run a function with the given space context stored in AsyncLocalStorage.
 * Used by HTTP auth middleware so Redis and Qdrant helpers can read space without request.
 */
export function runWithSpaceContext<T>(ctx: SpaceContext, fn: () => T): T {
  return spaceStorage.run(ctx, fn);
}

/**
 * Get space context from AsyncLocalStorage (set by auth middleware via runWithSpaceContext).
 * When not in a request (e.g. startup, background job), returns default single-tenant context.
 */
export function getSpaceContextFromStorage(): SpaceContext {
  return spaceStorage.getStore() ?? defaultSpaceContext();
}

/** Current space id for Redis key prefix and similar; uses storage or DEFAULT_SPACE_ID. */
export function getSpaceIdFromStorage(): string {
  return getSpaceContextFromStorage().defaultWriteSpaceId;
}

/**
 * If spaceParam is provided, validate it is in allowed spaces and run fn in a narrowed context.
 * Use from MCP tool handlers to support optional space/space_id argument.
 * @throws Error with message suitable for 403 if spaceParam is not allowed
 */
export function runWithOptionalSpace<T>(spaceParam: string | undefined, fn: () => T): T {
  if (!spaceParam || typeof spaceParam !== 'string') return fn();
  const ctx = getSpaceContextFromStorage();
  if (!ctx.allowedSpaceIds.includes(spaceParam)) {
    throw new Error('Requested space is not in your allowed spaces');
  }
  const narrowed: SpaceContext = {
    ...ctx,
    allowedSpaceIds: [spaceParam],
    defaultWriteSpaceId: spaceParam
  };
  return runWithSpaceContext(narrowed, fn);
}

/**
 * Build allowed space ids and default write space from auth payload (sub + groups + realm + optional group_ids).
 * Space IDs include realm for isolation across Keycloak realms; group ID is used when present so renames are stable.
 */
function fromAuthPayload(
  sub: string,
  groupNames: string[],
  realm: string,
  groupIds?: string[]
): Pick<SpaceContext, 'allowedSpaceIds' | 'defaultWriteSpaceId'> {
  const personal = `user:${realm}:${sub}`;
  const groupSpaces = groupNames.map((name, i) => {
    const ref = groupIds?.[i] ?? name;
    return `group:${realm}:${ref}`;
  });
  const allowedSpaceIds = [personal, ...groupSpaces];
  const defaultWriteSpaceId = personal;
  return { allowedSpaceIds, defaultWriteSpaceId };
}

/**
 * Get space context from request. Uses req.auth (set by auth middleware) when AUTH_ENABLED.
 * When no auth or AUTH_ENABLED=false, returns default single-tenant context.
 * If no request is passed, falls back to AsyncLocalStorage (e.g. from runWithSpaceContext).
 */
export function getSpaceContext(request?: {
  auth?: { sub: string; groups: string[]; realm?: string; group_ids?: string[] };
  spaceContext?: SpaceContext;
}): SpaceContext {
  if (request?.spaceContext) return request.spaceContext;
  const stored = spaceStorage.getStore();
  if (stored) return stored;
  if (!AUTH_ENABLED) return defaultSpaceContext();
  const auth = request?.auth;
  if (!auth?.sub) return defaultSpaceContext();
  const realm = auth.realm ?? 'default';
  const { allowedSpaceIds, defaultWriteSpaceId } = fromAuthPayload(
    auth.sub,
    auth.groups ?? [],
    realm,
    auth.group_ids
  );
  return {
    userId: auth.sub,
    groupIds: auth.groups ?? [],
    allowedSpaceIds,
    defaultWriteSpaceId
  };
}

/**
 * Get tenant ID for metrics. Returns default write space id or first allowed space.
 */
export function getTenantId(request?: any): string {
  const ctx = getSpaceContext(request);
  return ctx.defaultWriteSpaceId || ctx.allowedSpaceIds[0] || process.env['DEFAULT_TENANT_ID'] || 'default';
}
