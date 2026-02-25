/**
 * Auth middleware: when AUTH_ENABLED, require session or Bearer for /api and /mcp.
 * Unauthenticated browser GET -> redirect to Keycloak; otherwise 401 with login_url.
 * When AUTH_MODE=oidc_bearer, Bearer tokens are validated (issuer, audience, exp); req.auth is set from session or validated Bearer.
 */
import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import {
  AUTH_ENABLED,
  KEYCLOAK_URL,
  KEYCLOAK_REALM,
  KEYCLOAK_CLIENT_ID,
  AUTH_CALLBACK_BASE_URL,
  SESSION_SECRET,
  AUTH_MODE,
  AUTH_TRUSTED_ISSUERS,
  AUTH_ALLOWED_AUDIENCES
} from '../config.js';
import { validateBearerToken, type AuthPayload } from './bearer-validate.js';
import { getSpaceContext, runWithSpaceContext, type SpaceContext } from '../utils/tenant-context.js';
import { structuredLogger } from '../utils/structured-logger.js';

export type { AuthPayload };

const SESSION_COOKIE_NAME = 'kairos_session';
const STATE_TTL_MS = 600_000; // 10 min

interface StateEntry {
  codeVerifier: string;
  createdAt: number;
}
const stateStore = new Map<string, StateEntry>();

function pruneStateStore(): void {
  const now = Date.now();
  for (const [k, v] of stateStore.entries()) {
    if (now - v.createdAt > STATE_TTL_MS) stateStore.delete(k);
  }
}

function buildLoginUrl(state: string, codeChallenge: string): string {
  const base = KEYCLOAK_URL.replace(/\/$/, '');
  const redirectUri = `${AUTH_CALLBACK_BASE_URL.replace(/\/$/, '')}/auth/callback`;
  const params = new URLSearchParams({
    client_id: KEYCLOAK_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    // Force login page so a second browser gets a fresh login instead of SSO "already logged in" errors.
    prompt: 'login'
  });
  return `${base}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/auth?${params.toString()}`;
}

function getSessionCookie(req: Request): string | null {
  const raw = req.get('cookie');
  if (!raw) return null;
  const match = raw.split(';').map((s) => s.trim()).find((s) => s.startsWith(SESSION_COOKIE_NAME + '='));
  if (!match) return null;
  const value = match.slice((SESSION_COOKIE_NAME + '=').length).trim();
  return value ? decodeURIComponent(value) : null;
}

function hasValidSession(req: Request): boolean {
  return getSessionPayload(req) !== null;
}

/** Decode and verify session cookie; returns AuthPayload or null. */
function getSessionPayload(req: Request): AuthPayload | null {
  const cookie = getSessionCookie(req);
  if (!cookie || !SESSION_SECRET) return null;
  try {
    const [payloadB64, sig] = cookie.split('.');
    if (!payloadB64 || !sig) return null;
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()) as {
      sub?: string;
      groups?: string[];
      realm?: string;
      group_ids?: string[];
      exp?: number;
    };
    if (payload.exp && payload.exp < Date.now() / 1000) return null;
    const sub = typeof payload.sub === 'string' ? payload.sub : '';
    if (!sub) return null;
    const groups = Array.isArray(payload.groups) ? payload.groups.filter((g): g is string => typeof g === 'string') : [];
    const realm = typeof payload.realm === 'string' ? payload.realm : 'default';
    const group_ids = Array.isArray(payload.group_ids)
      ? payload.group_ids.filter((g): g is string => typeof g === 'string' && g.length > 0)
      : undefined;
    const result: AuthPayload = { sub, groups, realm };
    if (group_ids && group_ids.length > 0) result.group_ids = group_ids;
    return result;
  } catch {
    return null;
  }
}

function getBearerToken(req: Request): string | null {
  const auth = req.get('authorization');
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) return null;
  return auth.slice(7).trim() || null;
}

function hasBearer(req: Request): boolean {
  return getBearerToken(req) !== null;
}

/** Paths that require auth when AUTH_ENABLED: /api, /api/*, and /mcp (MCP-over-HTTP). */
function isProtectedPath(path: string): boolean {
  return path === '/api' || path.startsWith('/api/') || path === '/mcp';
}

/** Build WWW-Authenticate value. Use error=invalid_token so MCP clients clear stored token and restart OAuth (e.g. after Keycloak session cleanup). */
function buildWwwAuthenticate(opts?: { error?: 'invalid_token'; error_description?: string }): string {
  if (!AUTH_CALLBACK_BASE_URL) return '';
  const resourceMetadataUrl = `${AUTH_CALLBACK_BASE_URL.replace(/\/$/, '')}/.well-known/oauth-protected-resource`;
  const parts = [`Bearer realm="mcp"`, `resource_metadata="${resourceMetadataUrl}"`, 'scope="openid"'];
  if (opts?.error) {
    parts.unshift(`error="${opts.error}"`);
    if (opts.error_description) parts.push(`error_description="${opts.error_description.replace(/"/g, '\\"')}"`);
  }
  return parts.join(', ');
}

export function setWwwAuthenticate(res: Response, opts?: { error?: 'invalid_token'; error_description?: string }): void {
  const value = buildWwwAuthenticate(opts);
  if (value) res.setHeader('WWW-Authenticate', value);
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
      spaceContext?: SpaceContext;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!AUTH_ENABLED) {
    next();
    return;
  }
  if (req.path === '/auth/callback') {
    next();
    return;
  }
  if (!isProtectedPath(req.path)) {
    next();
    return;
  }

  const hasSession = hasValidSession(req);
  const hasBearerReq = hasBearer(req);
  structuredLogger.debug(
    `[auth] protected ${req.method} ${req.path} session=${hasSession} bearer=${!!hasBearerReq}`
  );

  function runNext(ctx: SpaceContext): void {
    const spaceParam = (req.query?.['space'] ?? req.query?.['space_id']) as string | undefined;
    if (spaceParam && typeof spaceParam === 'string') {
      if (!ctx.allowedSpaceIds.includes(spaceParam)) {
        res.status(403).json({ error: 'forbidden', message: 'Requested space is not in your allowed spaces' });
        return;
      }
      ctx = {
        ...ctx,
        allowedSpaceIds: [spaceParam],
        defaultWriteSpaceId: spaceParam
      };
    }
    req.spaceContext = ctx;
    runWithSpaceContext(ctx, () => next());
  }

  if (hasSession) {
    const payload = getSessionPayload(req);
    if (payload) req.auth = payload;
    structuredLogger.debug(`[auth] allowed session ${req.method} ${req.path}`);
    runNext(getSpaceContext(req));
    return;
  }

  if (hasBearerReq) {
    if (process.env['AUTH_TRACE'] === 'true' || process.env['LOG_LEVEL'] === 'trace') {
      structuredLogger.info(
        `[auth] TRACE raw call ${req.method} ${req.path} bearer=true trusted_issuers=${JSON.stringify(AUTH_TRUSTED_ISSUERS)} allowed_audiences=${JSON.stringify(AUTH_ALLOWED_AUDIENCES)}`
      );
    }
    const hasIssuerAndAudience = AUTH_TRUSTED_ISSUERS.length > 0 && AUTH_ALLOWED_AUDIENCES.length > 0;
    const canValidateBearer =
      hasIssuerAndAudience && (AUTH_MODE === 'oidc_bearer' || AUTH_ENABLED);
    structuredLogger.info(
      `[auth] Bearer check path=${req.path} canValidate=${canValidateBearer} AUTH_MODE=${AUTH_MODE} trusted_issuers=${AUTH_TRUSTED_ISSUERS.length} allowed_audiences=${AUTH_ALLOWED_AUDIENCES.length}`
    );
    if (!canValidateBearer) {
      structuredLogger.info(`[auth] 401 ${req.method} ${req.path} bearer_not_validated (config missing)`);
      setWwwAuthenticate(res);
      res.status(401).json({
        error: 'bearer_not_validated',
        message:
          'Bearer tokens are not validated when issuer/audience are not configured. Set AUTH_TRUSTED_ISSUERS and AUTH_ALLOWED_AUDIENCES (and AUTH_MODE=oidc_bearer or AUTH_ENABLED) to use Bearer auth.'
      });
      return;
    }
    const token = getBearerToken(req);
    try {
      const payload = await validateBearerToken(token!, AUTH_TRUSTED_ISSUERS, AUTH_ALLOWED_AUDIENCES);
      if (payload) {
        req.auth = payload;
        structuredLogger.debug(`[auth] allowed bearer ${req.method} ${req.path}`);
        runNext(getSpaceContext(req));
      } else {
        structuredLogger.info(`[auth] 401 ${req.method} ${req.path} bearer invalid or expired`);
        setWwwAuthenticate(res, {
          error: 'invalid_token',
          error_description: 'Token expired or invalid; re-authenticate to obtain a new token'
        });
        res.status(401).json({ error: 'invalid_token', message: 'Bearer token invalid or expired' });
      }
    } catch {
      structuredLogger.info(`[auth] 401 ${req.method} ${req.path} bearer validation failed`);
      setWwwAuthenticate(res, {
        error: 'invalid_token',
        error_description: 'Token validation failed; re-authenticate to obtain a new token'
      });
      res.status(401).json({ error: 'invalid_token', message: 'Bearer token validation failed' });
    }
    return;
  }

  if (!AUTH_CALLBACK_BASE_URL) {
    res.status(503).json({
      error: 'Auth misconfigured',
      message: 'AUTH_CALLBACK_BASE_URL is required when AUTH_ENABLED is true. Set it in .env (e.g. http://localhost:3500).'
    });
    return;
  }

  const loginUrl = (s: string, cc: string) => buildLoginUrl(s, cc);
  const state = crypto.randomBytes(16).toString('base64url');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url').replace(/=/g, '');
  stateStore.set(state, { codeVerifier, createdAt: Date.now() });
  pruneStateStore();

  // MCP client must receive 401 + WWW-Authenticate to show "Needs authentication" / Connect.
  // Redirect (302) would prevent discovery; always return 401 for /mcp.
  const isMcp = req.path === '/mcp';
  if (req.method === 'GET' && !isMcp) {
    structuredLogger.info(`[auth] 302 ${req.method} ${req.path} redirect to login`);
    res.redirect(302, loginUrl(state, codeChallenge));
    return;
  }
  structuredLogger.info(
    `[auth] 401 ${req.method} ${req.path}${isMcp ? ' (announcing auth need for MCP client)' : ''}`
  );
  setWwwAuthenticate(res);
  res.status(401).json({
    error: 'Unauthorized',
    message: 'Authentication required',
    login_url: loginUrl(state, codeChallenge)
  });
}

export function getStateStore(): Map<string, StateEntry> {
  return stateStore;
}

export { SESSION_COOKIE_NAME };
