/**
 * OIDC callback: exchange Keycloak authorization code for tokens, set session cookie, redirect.
 */
import express from 'express';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import { toBase64url } from '@exodus/bytes/base64.js';
import { utf8fromString } from '@exodus/bytes/utf8.js';
import {
  AUTH_ENABLED,
  KEYCLOAK_URL,
  KEYCLOAK_INTERNAL_URL,
  KEYCLOAK_REALM,
  KEYCLOAK_CLIENT_ID,
  AUTH_CALLBACK_BASE_URL,
  SESSION_SECRET,
  SESSION_MAX_AGE_SEC,
  OIDC_GROUPS_ALLOWLIST
} from '../config.js';
import { structuredLogger } from '../utils/structured-logger.js';
import {
  buildOidcEndSessionRedirectUrl,
  getOidcStateStore,
  redirectBrowserToOidcLogin
} from './http-auth-oidc-redirect.js';
import { peekOidcIdTokenHintFromSession, SESSION_COOKIE_NAME } from './http-auth-middleware.js';
import {
  applyOidcGroupsAllowlist,
  decodeJwtPayloadSegment,
  mergeCallbackTokenPayloads,
  type MergedCallbackClaims
} from './oidc-profile-claims.js';

function signSession(
  payload: MergedCallbackClaims & {
    exp: number;
  }
): string {
  const payloadB64 = toBase64url(utf8fromString(JSON.stringify(payload)));
  const sig = toBase64url(
    new Uint8Array(crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest())
  );
  return `${payloadB64}.${sig}`;
}

const useSecureCookie = AUTH_CALLBACK_BASE_URL.trim().toLowerCase().startsWith('https://');

/** Cookie options must match those used when setting the session (Path=/) so the browser clears it. */
const COOKIE_CLEAR_OPTIONS = { path: '/', httpOnly: true, sameSite: 'lax' as const, secure: useSecureCookie };

/** Keycloak post_logout_redirect_uri target: immediately starts a new OIDC login (no logged-out landing in our app). */
const AUTH_CONTINUE_SIGNIN_PATH = '/auth/continue-signin';

function redirectContinueSignin(_req: Request, res: Response): void {
  if (AUTH_ENABLED && redirectBrowserToOidcLogin(res)) {
    return;
  }
  res.redirect(302, '/ui/');
}

export function setupAuthCallback(app: express.Express): void {
  // Base /auth: redirect to UI (browser) or 404 for API
  app.get('/auth', (_req: Request, res: Response) => {
    res.redirect(302, '/ui');
  });

  /** Older callback target; redirect for bookmarks and docs that still link here. */
  app.get('/auth/success', (_req: Request, res: Response) => {
    res.redirect(302, '/ui/');
  });

  /**
   * Clear Kairos session, end Keycloak SSO (RP-initiated logout), then continue at continue-signin → OIDC login.
   * id_token_hint (when present in session) avoids Keycloak static logged-out confirmation where supported.
   */
  app.get('/auth/logout', (req: Request, res: Response) => {
    const idHint = peekOidcIdTokenHintFromSession(req);
    res.clearCookie(SESSION_COOKIE_NAME, COOKIE_CLEAR_OPTIONS);
    const base = AUTH_CALLBACK_BASE_URL?.trim().replace(/\/$/, '');
    if (AUTH_ENABLED && base) {
      const resume = `${base}${AUTH_CONTINUE_SIGNIN_PATH}`;
      const endSession = buildOidcEndSessionRedirectUrl(resume, idHint);
      if (endSession) {
        res.redirect(302, endSession);
        return;
      }
    }
    if (AUTH_ENABLED && redirectBrowserToOidcLogin(res)) {
      return;
    }
    res.redirect(302, '/ui/');
  });

  app.get(AUTH_CONTINUE_SIGNIN_PATH, redirectContinueSignin);

  /** Optional IdP post-logout redirect target (same as continue-signin). */
  app.get('/auth/logged-out', redirectContinueSignin);

  app.get('/auth/callback', async (req: Request, res: Response) => {
    if (!AUTH_ENABLED || !KEYCLOAK_URL || !SESSION_SECRET || !AUTH_CALLBACK_BASE_URL) {
      res.status(503).json({
        error: 'Auth not configured',
        message: 'AUTH_ENABLED, KEYCLOAK_URL, SESSION_SECRET, and AUTH_CALLBACK_BASE_URL are required. Set in .env (see docs/install/README.md).'
      });
      return;
    }
    const { code, state } = req.query as { code?: string; state?: string };
    if (!code || !state) {
      res.redirect(302, '/?error=missing_code_or_state');
      return;
    }
    const store = getOidcStateStore();
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
    const idToken = typeof tokens.id_token === 'string' ? tokens.id_token : undefined;
    const accessToken = typeof tokens.access_token === 'string' ? tokens.access_token : undefined;
    if (!idToken && !accessToken) {
      structuredLogger.info('Auth callback: no id_token or access_token in response');
      res.redirect(302, '/?error=no_tokens');
      return;
    }
    const idPayload = idToken ? decodeJwtPayloadSegment(idToken) : null;
    const accessPayload = accessToken ? decodeJwtPayloadSegment(accessToken) : null;
    if (idPayload === null && accessPayload === null) {
      structuredLogger.info('Auth callback: token payload parse failed');
      res.redirect(302, '/?error=invalid_token_payload');
      return;
    }
    const mergedResult = mergeCallbackTokenPayloads({
      idPayload,
      accessPayload,
      fallbackRealm: KEYCLOAK_REALM
    });
    if (!mergedResult.ok) {
      structuredLogger.info(`Auth callback: merge failed ${mergedResult.error}`);
      const err =
        mergedResult.error === 'mismatched_sub' ? 'mismatched_token_sub' : 'invalid_token_sub';
      res.redirect(302, `/?error=${err}`);
      return;
    }
    const { merged } = mergedResult;
    merged.groups = applyOidcGroupsAllowlist(merged.groups, OIDC_GROUPS_ALLOWLIST);
    const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC;
    const sessionPayload: MergedCallbackClaims & { exp: number; oidc_id_token?: string } = {
      ...merged,
      exp,
      ...(idToken ? { oidc_id_token: idToken } : {})
    };
    const cookieValue = signSession(sessionPayload);
    res.setHeader('Set-Cookie', [
      `${SESSION_COOKIE_NAME}=${encodeURIComponent(cookieValue)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SEC}${useSecureCookie ? '; Secure' : ''}`
    ]);
    res.redirect(302, '/ui/');
  });
}
