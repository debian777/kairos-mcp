/**
 * Space and tenant context for multitenancy.
 * SpaceContext is derived from Keycloak (sub + groups); getTenantId() remains for metrics.
 * AsyncLocalStorage allows Redis and other services to get current space without request reference.
 * When AUTH_ENABLED, default space is disabled for strict isolation; unauthenticated/no-context
 * uses a sentinel space so no tenant data is shared.
 */

import { AsyncLocalStorage } from 'async_hooks';
import { AUTH_ENABLED, DEFAULT_SPACE_ID, KAIROS_APP_SPACE_ID } from '../config.js';

/** Sentinel space when AUTH is on but no auth context (strict isolation; not shared with tenants). */
export const NO_AUTH_SPACE_ID = 'space:no-auth';

export interface SpaceContext {
  userId: string;
  groupIds: string[];
  allowedSpaceIds: string[];
  defaultWriteSpaceId: string;
}

/** Sentinel for "no context" when restoring after runWithSpaceContextAsync (enterWith does not accept undefined). */
const NO_CONTEXT_SENTINEL: SpaceContext = {
  userId: '',
  groupIds: [],
  allowedSpaceIds: [],
  defaultWriteSpaceId: ''
};

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

/** Context when AUTH_ENABLED and no auth/storage — no access to shared default space. */
function noDefaultSpaceContext(): SpaceContext {
  return {
    userId: '',
    groupIds: [],
    allowedSpaceIds: [],
    defaultWriteSpaceId: NO_AUTH_SPACE_ID
  };
}

/**
 * Run a function with the given space context stored in AsyncLocalStorage.
 * Used by HTTP auth middleware so Redis and Qdrant helpers can read space without request.
 * For sync callbacks the context is preserved. For async callbacks use runWithSpaceContextAsync
 * so the context persists across await boundaries (run() loses context after the callback returns a Promise).
 */
export function runWithSpaceContext<T>(ctx: SpaceContext, fn: () => T): T {
  return spaceStorage.run(ctx, fn);
}

/**
 * Run an async function with the given space context. Uses enterWith so the context
 * persists for the entire async execution (including all await continuations).
 * Use this when the callback does async work (e.g. storeChain) and getSpaceContext()
 * must see the context inside that work.
 */
export async function runWithSpaceContextAsync<T>(ctx: SpaceContext, fn: () => Promise<T>): Promise<T> {
  const prev = spaceStorage.getStore();
  spaceStorage.enterWith(ctx);
  try {
    return await fn();
  } finally {
    spaceStorage.enterWith(prev ?? NO_CONTEXT_SENTINEL);
  }
}

/**
 * Get space context from AsyncLocalStorage (set by auth middleware via runWithSpaceContext).
 * When not in a request: if AUTH_ENABLED, returns no-default context (strict isolation);
 * otherwise returns default single-tenant context.
 */
export function getSpaceContextFromStorage(): SpaceContext {
  const stored = spaceStorage.getStore();
  if (stored && stored !== NO_CONTEXT_SENTINEL) return stored;
  return AUTH_ENABLED ? noDefaultSpaceContext() : defaultSpaceContext();
}

/** Current space id for Redis key prefix and similar; uses storage or DEFAULT_SPACE_ID. */
export function getSpaceIdFromStorage(): string {
  return getSpaceContextFromStorage().defaultWriteSpaceId;
}

/**
 * Space IDs to use for search only: allowedSpaceIds plus Kairos app space (deduped).
 * Writes (mint, update, delete) continue to use allowedSpaceIds only.
 */
export function getSearchSpaceIds(): string[] {
  const ctx = getSpaceContextFromStorage();
  const allowed = ctx.allowedSpaceIds;
  if (allowed.includes(KAIROS_APP_SPACE_ID)) return [...allowed];
  return [...allowed, KAIROS_APP_SPACE_ID];
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
 * Async variant: run fn in narrowed space context so context persists across await.
 * Use when the callback does async work (e.g. kairos_search) and getSpaceContext() must see the context.
 */
export async function runWithOptionalSpaceAsync<T>(spaceParam: string | undefined, fn: () => Promise<T>): Promise<T> {
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
  return runWithSpaceContextAsync(narrowed, fn);
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
 * When AUTH_ENABLED and no auth, returns no-default context (strict isolation).
 * When AUTH_ENABLED=false, returns default single-tenant context.
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
  if (!auth?.sub) return noDefaultSpaceContext();
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
