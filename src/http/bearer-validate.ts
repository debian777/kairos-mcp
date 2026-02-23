/**
 * Bearer JWT validation for OIDC (Keycloak). Verifies iss, aud, exp and signature via JWKS.
 */
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { decodeJwt } from 'jose/jwt/decode';
import { logger } from '../utils/logger.js';

export interface AuthPayload {
  sub: string;
  groups: string[];
  /** Realm from token issuer (e.g. kairos-dev) for space isolation. */
  realm: string;
  /** Optional group UUIDs from token; when present used for space ID so renames are stable. */
  group_ids?: string[];
}

const JWKS_CACHE = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwksForIssuer(issuer: string): ReturnType<typeof createRemoteJWKSet> {
  const cached = JWKS_CACHE.get(issuer);
  if (cached) return cached;
  const url = `${issuer.replace(/\/$/, '')}/protocol/openid-connect/certs`;
  const jwks = createRemoteJWKSet(new URL(url));
  JWKS_CACHE.set(issuer, jwks);
  return jwks;
}

/** Decode JWT payload without verification (issuer check only). */
function decodePayload(jwt: string): Record<string, unknown> {
  return decodeJwt(jwt) as Record<string, unknown>;
}

function extractGroups(payload: Record<string, unknown>): string[] {
  const g = payload['groups'];
  if (Array.isArray(g)) return g.filter((x): x is string => typeof x === 'string');
  const realm = payload['realm_access'] as { roles?: string[] } | undefined;
  if (realm && Array.isArray(realm.roles)) return realm.roles.filter((x): x is string => typeof x === 'string');
  return [];
}

/** Extract realm from issuer URL (e.g. http://keycloak:8080/realms/kairos-dev -> kairos-dev). */
function realmFromIssuer(iss: string): string {
  const match = /\/realms\/([^/]+)/.exec(iss);
  const segment = match?.[1] ?? iss.split('/').filter(Boolean).pop();
  return typeof segment === 'string' ? segment : 'default';
}

function extractGroupIds(payload: Record<string, unknown>): string[] | undefined {
  const g = payload['group_ids'];
  if (Array.isArray(g)) {
    const ids = g.filter((x): x is string => typeof x === 'string' && x.length > 0);
    return ids.length > 0 ? ids : undefined;
  }
  return undefined;
}

/**
 * Validate Bearer JWT: iss in trusted list, aud in allowed list, exp not expired, signature valid.
 * Returns { sub, groups } or null if invalid.
 */
export async function validateBearerToken(
  token: string,
  trustedIssuers: string[],
  allowedAudiences: string[]
): Promise<AuthPayload | null> {
  if (!token || trustedIssuers.length === 0 || allowedAudiences.length === 0) return null;
  let payload: Record<string, unknown>;
  try {
    const unverified = decodePayload(token);
    const iss = typeof unverified['iss'] === 'string' ? unverified['iss'] : undefined;
    if (!iss || !trustedIssuers.includes(iss)) {
      logger.debug(`[Bearer] Issuer not trusted ${JSON.stringify({ iss, trusted: trustedIssuers })}`);
      return null;
    }
    const jwks = getJwksForIssuer(iss);
    const getKey = (protectedHeader: Parameters<ReturnType<typeof createRemoteJWKSet>>[0]) => jwks(protectedHeader);
    const { payload: p } = await jwtVerify(token, getKey, { issuer: iss });
    payload = p as Record<string, unknown>;
  } catch (err) {
    logger.debug(`[Bearer] JWT verify failed ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
  const aud = payload['aud'];
  const audList = Array.isArray(aud) ? aud : typeof aud === 'string' ? [aud] : [];
  const hasAudience = allowedAudiences.some((a) => audList.includes(a));
  if (!hasAudience) {
    logger.debug(`[Bearer] Audience not allowed ${JSON.stringify({ aud: audList, allowed: allowedAudiences })}`);
    return null;
  }
  const sub = typeof payload['sub'] === 'string' ? payload['sub'] : '';
  if (!sub) return null;
  const iss = typeof payload['iss'] === 'string' ? payload['iss'] : '';
  const realm = realmFromIssuer(iss);
  const groups = extractGroups(payload);
  const group_ids = extractGroupIds(payload);
  const result: AuthPayload = { sub, groups, realm };
  if (group_ids && group_ids.length > 0) result.group_ids = group_ids;
  return result;
}
