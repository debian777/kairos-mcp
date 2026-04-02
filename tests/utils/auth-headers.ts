/**
 * Auth headers for integration tests when AUTH_ENABLED=true.
 * Reads .test-auth-env.dev.json written by globalSetup (when server requires auth).
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

/** Same convention as global-setup-auth: .test-auth-env.dev.json */
function getAuthEnvFilePath(): string {
  return join(process.cwd(), '.test-auth-env.dev.json');
}

export const TEST_USERNAME = 'kairos-tester';
export const TEST_PASSWORD = 'kairos-tester-secret';

interface TestAuthEnv {
  bearerToken?: string;
  baseUrl?: string;
  keycloakUrl?: string;
  /** Space of kairos-tester (user:realm:sub from token); use for activate space_id so tests use actual test user scope */
  spaceId?: string;
}

let cached: TestAuthEnv | null | undefined = undefined;

function readAuthEnv(): TestAuthEnv | null {
  if (cached !== undefined) return cached;
  const path = getAuthEnvFilePath();
  if (!existsSync(path)) {
    cached = null;
    return null;
  }
  try {
    const raw = readFileSync(path, 'utf-8');
    cached = JSON.parse(raw) as TestAuthEnv;
    return cached;
  } catch {
    cached = null;
    return null;
  }
}

/** Invalidate cached auth env file so next read re-reads from disk. */
export function invalidateAuthEnvCache(): void {
  cached = undefined;
}

async function fetchKeycloakToken(
  keycloakUrl: string,
  realm: string,
  clientId: string,
  username: string,
  password: string
): Promise<string> {
  const tokenUrl = `${keycloakUrl.replace(/\/$/, '')}/realms/${realm}/protocol/openid-connect/token`;
  /** Include `kairos-groups` so access token + userinfo carry Group Membership (integration / #278). */
  const scope =
    process.env.KAIROS_TEST_OIDC_SCOPE?.trim() || 'openid profile email kairos-groups';
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: clientId,
      username,
      password,
      scope
    })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Keycloak token failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error('No access_token in Keycloak response');
  return data.access_token;
}

/**
 * Fetch a fresh Keycloak token and update `.test-auth-env.dev.json`.
 * Works from `process.env` alone (KEYCLOAK_URL, KEYCLOAK_REALM, KEYCLOAK_CLIENT_ID) so integration
 * tests get `kairos-groups` + password grant even when the auth file is missing or stale (#278).
 */
export async function refreshTestAuthToken(): Promise<boolean> {
  if (process.env.AUTH_ENABLED !== 'true') return false;
  const keycloakUrl = process.env.KEYCLOAK_URL?.replace(/\/$/, '');
  const realm = process.env.KEYCLOAK_REALM?.trim();
  const clientId = process.env.KEYCLOAK_CLIENT_ID?.trim();
  if (!keycloakUrl || !realm || !clientId) return false;
  const port = process.env.PORT || '3300';
  const baseUrl =
    readAuthEnv()?.baseUrl?.trim() ||
    process.env.KAIROS_TEST_BASE_URL?.trim() ||
    `http://localhost:${port}`;
  const username = process.env.TEST_USERNAME?.trim() || TEST_USERNAME;
  const password = process.env.TEST_PASSWORD?.trim() || TEST_PASSWORD;
  try {
    const token = await fetchKeycloakToken(keycloakUrl, realm, clientId, username, password);
    const prev = readAuthEnv();
    const next: TestAuthEnv = {
      ...(prev ?? {}),
      bearerToken: token,
      baseUrl,
      keycloakUrl
    };
    writeFileSync(getAuthEnvFilePath(), JSON.stringify(next));
    invalidateAuthEnvCache();
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns headers to attach to requests when running with auth.
 * When the env-specific auth file exists and has bearerToken, returns { Authorization: 'Bearer <token>' }; otherwise {}.
 */
export function getAuthHeaders(): Record<string, string> {
  const env = readAuthEnv();
  if (env?.bearerToken) return { Authorization: `Bearer ${env.bearerToken}` };
  return {};
}

/**
 * Base URL for the app. When AUTH_ENABLED=true and the auth file exists, use its baseUrl; otherwise http://localhost:PORT.
 */
export function getTestAuthBaseUrl(): string {
  if (process.env.AUTH_ENABLED === 'true') {
    const env = readAuthEnv();
    if (env?.baseUrl) return env.baseUrl;
  }
  const port = process.env.PORT || '3300';
  return `http://localhost:${port}`;
}

/** Keycloak base URL from auth env (preferred) or KEYCLOAK_URL fallback. */
export function getTestKeycloakUrl(): string | undefined {
  const env = readAuthEnv();
  if (env?.keycloakUrl) return env.keycloakUrl;
  const fallback = process.env.KEYCLOAK_URL?.trim();
  return fallback ? fallback.replace(/\/$/, '') : undefined;
}

/** True when server requires auth (from .env). */
export function serverRequiresAuth(): boolean {
  return process.env.AUTH_ENABLED === 'true';
}

/** True when we have a token (e.g. env-specific auth file written by globalSetup). */
export function hasAuthToken(): boolean {
  return readAuthEnv()?.bearerToken != null;
}

/** Raw bearer token from the test auth file (MCP transport, CLI subprocess env). */
export function getMcpTestBearerToken(): string | undefined {
  return readAuthEnv()?.bearerToken ?? undefined;
}

/** Space ID of kairos-tester (user:realm:sub) when AUTH_ENABLED and token present. Pass as space_id to activate so tests use actual test user scope. */
export function getTestSpaceId(): string | undefined {
  return readAuthEnv()?.spaceId ?? undefined;
}

