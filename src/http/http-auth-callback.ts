/**
 * OIDC callback: exchange Keycloak authorization code for tokens, set session cookie, redirect.
 */
import express from 'express';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import {
  AUTH_ENABLED,
  KEYCLOAK_URL,
  KEYCLOAK_INTERNAL_URL,
  KEYCLOAK_REALM,
  KEYCLOAK_CLIENT_ID,
  AUTH_CALLBACK_BASE_URL,
  SESSION_SECRET,
  SESSION_MAX_AGE_SEC
} from '../config.js';
import { structuredLogger } from '../utils/structured-logger.js';
import { getStateStore, SESSION_COOKIE_NAME } from './http-auth-middleware.js';

function signSession(payload: {
  sub: string;
  groups: string[];
  realm: string;
  group_ids?: string[];
  exp: number;
}): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

function realmFromIssuer(iss: string): string {
  const match = /\/realms\/([^/]+)/.exec(iss);
  const segment = match?.[1] ?? iss.split('/').filter(Boolean).pop();
  return typeof segment === 'string' ? segment : 'default';
}

const AUTH_SUCCESS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Authentication successful – KAIROS</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #1a1a1a; color: #e5e5e5; text-align: center; }
    .box { padding: 2rem; max-width: 24rem; }
    h1 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; }
    p { color: #a3a3a3; margin: 0; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Authentication successful</h1>
    <p>You can close this page and return to Cursor.</p>
  </div>
</body>
</html>
`;

const AUTH_LOGGED_OUT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Logged out – KAIROS</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #1a1a1a; color: #e5e5e5; text-align: center; }
    .box { padding: 2rem; max-width: 24rem; }
    h1 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; }
    p { color: #a3a3a3; margin: 0; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Session cleared</h1>
    <p>You are logged out. You can close this page.</p>
  </div>
</body>
</html>
`;

/** Cookie options must match those used when setting the session (Path=/) so the browser clears it. */
const COOKIE_CLEAR_OPTIONS = { path: '/', httpOnly: true, sameSite: 'lax' as const };

export function setupAuthCallback(app: express.Express): void {
  app.get('/auth/success', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(AUTH_SUCCESS_HTML);
  });

  app.get('/auth/logout', (_req: Request, res: Response) => {
    res.clearCookie(SESSION_COOKIE_NAME, COOKIE_CLEAR_OPTIONS);
    res.redirect(302, '/auth/logged-out');
  });

  app.get('/auth/logged-out', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(AUTH_LOGGED_OUT_HTML);
  });

  app.get('/auth/callback', async (req: Request, res: Response) => {
    if (!AUTH_ENABLED || !KEYCLOAK_URL || !SESSION_SECRET || !AUTH_CALLBACK_BASE_URL) {
      res.status(503).json({
        error: 'Auth not configured',
        message: 'AUTH_ENABLED, KEYCLOAK_URL, SESSION_SECRET, and AUTH_CALLBACK_BASE_URL are required. Set in .env (see env.example.txt).'
      });
      return;
    }
    const { code, state } = req.query as { code?: string; state?: string };
    if (!code || !state) {
      res.redirect(302, '/?error=missing_code_or_state');
      return;
    }
    const store = getStateStore();
    const entry = store.get(state);
    store.delete(state);
    if (!entry) {
      structuredLogger.info('Auth callback: invalid or expired state');
      res.redirect(302, '/?error=invalid_state');
      return;
    }
    const keycloakBase = (KEYCLOAK_INTERNAL_URL || KEYCLOAK_URL).replace(/\/$/, '');
    const redirectUri = `${AUTH_CALLBACK_BASE_URL.replace(/\/$/, '')}/auth/callback`;
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: KEYCLOAK_CLIENT_ID,
      code,
      redirect_uri: redirectUri,
      code_verifier: entry.codeVerifier
    });
    let tokenRes: globalThis.Response;
    try {
      tokenRes = await fetch(`${keycloakBase}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });
    } catch (err) {
      structuredLogger.error('Auth callback: token request failed', err);
      res.redirect(302, '/?error=token_request_failed');
      return;
    }
    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      structuredLogger.info(`Auth callback: token error ${JSON.stringify({ status: tokenRes.status, body: text })}`);
      res.redirect(302, '/?error=token_exchange_failed');
      return;
    }
    const tokens = (await tokenRes.json()) as { id_token?: string; access_token?: string };
    const idToken = tokens.id_token;
    const accessToken = tokens.access_token;
    const tokenToDecode = idToken ?? accessToken;
    if (!tokenToDecode || typeof tokenToDecode !== 'string') {
      structuredLogger.info('Auth callback: no id_token or access_token in response');
      res.redirect(302, '/?error=no_tokens');
      return;
    }
    let sub: string | null = null;
    let groups: string[] = [];
    let realm = KEYCLOAK_REALM;
    let group_ids: string[] | undefined;
    try {
      const segment = tokenToDecode.split('.')[1];
      const payload = segment
        ? (JSON.parse(Buffer.from(segment, 'base64url').toString()) as {
            sub?: string;
            iss?: string;
            groups?: string[];
            group_ids?: string[];
            realm_access?: { roles?: string[] };
          })
        : null;
      if (!payload || typeof payload.sub !== 'string' || payload.sub.length === 0) {
        structuredLogger.info('Auth callback: could not extract sub from token');
        res.redirect(302, '/?error=invalid_token_sub');
        return;
      }
      sub = payload.sub;
      if (Array.isArray(payload.groups)) groups = payload.groups.filter((g): g is string => typeof g === 'string');
      else if (payload.realm_access && Array.isArray(payload.realm_access.roles))
        groups = payload.realm_access.roles.filter((r): r is string => typeof r === 'string');
      if (typeof payload.iss === 'string') realm = realmFromIssuer(payload.iss);
      const g = payload.group_ids;
      if (Array.isArray(g)) {
        const ids = g.filter((x): x is string => typeof x === 'string' && x.length > 0);
        if (ids.length > 0) group_ids = ids;
      }
    } catch {
      structuredLogger.info('Auth callback: token payload parse failed');
      res.redirect(302, '/?error=invalid_token_payload');
      return;
    }
    if (sub === null) {
      res.redirect(302, '/?error=invalid_token_sub');
      return;
    }
    const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC;
    const sessionPayload: { sub: string; groups: string[]; realm: string; group_ids?: string[]; exp: number } = {
      sub,
      groups,
      realm,
      exp
    };
    if (group_ids && group_ids.length > 0) sessionPayload.group_ids = group_ids;
    const cookieValue = signSession(sessionPayload);
    res.setHeader('Set-Cookie', [
      `${SESSION_COOKIE_NAME}=${encodeURIComponent(cookieValue)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SEC}`
    ]);
    res.redirect(302, '/auth/success');
  });
}
