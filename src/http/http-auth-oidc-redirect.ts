/**
 * Browser OIDC login redirect + PKCE state shared by auth middleware and /auth/logout.
 */
import type { Response } from 'express';
import crypto from 'crypto';
import { KEYCLOAK_URL, KEYCLOAK_REALM, KEYCLOAK_CLIENT_ID, AUTH_CALLBACK_BASE_URL } from '../config.js';

const STATE_TTL_MS = 600_000; // 10 min

export interface OidcStateEntry {
  codeVerifier: string;
  createdAt: number;
}

const stateStore = new Map<string, OidcStateEntry>();

export function pruneOidcStateStore(): void {
  const now = Date.now();
  for (const [k, v] of stateStore.entries()) {
    if (now - v.createdAt > STATE_TTL_MS) stateStore.delete(k);
  }
}

export function getOidcStateStore(): Map<string, OidcStateEntry> {
  return stateStore;
}

export function buildOidcAuthorizationUrl(state: string, codeChallenge: string): string {
  if (!AUTH_CALLBACK_BASE_URL) {
    throw new Error('AUTH_CALLBACK_BASE_URL is required for OIDC login URL');
  }
  const base = KEYCLOAK_URL.replace(/\/$/, '');
  const redirectUri = `${AUTH_CALLBACK_BASE_URL.replace(/\/$/, '')}/auth/callback`;
  const params = new URLSearchParams({
    client_id: KEYCLOAK_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'login'
  });
  return `${base}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/auth?${params.toString()}`;
}

/**
 * RP-initiated OIDC logout URL. After the IdP clears the SSO session it redirects to
 * postLogoutRedirectUri (must be registered as a valid post-logout redirect for the client).
 */
export function buildOidcEndSessionRedirectUrl(postLogoutRedirectUri: string, idTokenHint: string | null): string | null {
  if (!KEYCLOAK_URL || !KEYCLOAK_REALM || !KEYCLOAK_CLIENT_ID) {
    return null;
  }
  const base = KEYCLOAK_URL.replace(/\/$/, '');
  const u = new URL(`${base}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/logout`);
  u.searchParams.set('client_id', KEYCLOAK_CLIENT_ID);
  u.searchParams.set('post_logout_redirect_uri', postLogoutRedirectUri);
  if (idTokenHint) {
    u.searchParams.set('id_token_hint', idTokenHint);
  }
  return u.toString();
}

/** Allocate PKCE state and redirect the browser to the IdP authorization endpoint. */
export function redirectBrowserToOidcLogin(res: Response): boolean {
  if (!AUTH_CALLBACK_BASE_URL) {
    return false;
  }
  const state = crypto.randomBytes(16).toString('base64url');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url').replace(/=/g, '');
  stateStore.set(state, { codeVerifier, createdAt: Date.now() });
  pruneOidcStateStore();
  res.redirect(302, buildOidcAuthorizationUrl(state, codeChallenge));
  return true;
}

/** Register PKCE state and return the authorization URL (for JSON login_url). */
export function createOidcLoginUrlForApiResponse(): string {
  const state = crypto.randomBytes(16).toString('base64url');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url').replace(/=/g, '');
  stateStore.set(state, { codeVerifier, createdAt: Date.now() });
  pruneOidcStateStore();
  return buildOidcAuthorizationUrl(state, codeChallenge);
}
