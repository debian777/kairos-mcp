/**
 * Auth headers for integration tests when AUTH_ENABLED=true.
 * Reads .test-auth-env.json written by globalSetup (when server requires auth).
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

const AUTH_ENV_FILE = '.test-auth-env.json';
const QA_REALM = 'kairos-qa';
const REALM = 'kairos-dev';
const CLIENT_ID = 'kairos-mcp';
const TEST_USERNAME = 'kairos-tester';
const TEST_PASSWORD = 'kairos-tester-secret';

interface TestAuthEnv {
  bearerToken?: string;
  baseUrl?: string;
  keycloakUrl?: string;
}

let cached: TestAuthEnv | null | undefined = undefined;

function readAuthEnv(): TestAuthEnv | null {
  if (cached !== undefined) return cached;
  const path = join(process.cwd(), AUTH_ENV_FILE);
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

/** Invalidate cached .test-auth-env.json so next read re-reads from disk. */
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
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: clientId,
      username,
      password
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
 * Fetch a fresh Keycloak token and update .test-auth-env.json.
 * Uses KEYCLOAK_DEV_* (ENV=dev) or KEYCLOAK_QA_* (ENV=qa). Returns true if refreshed.
 */
export async function refreshTestAuthToken(): Promise<boolean> {
  if (process.env.AUTH_ENABLED !== 'true') return false;
  const env = readAuthEnv();
  if (!env?.baseUrl || !env?.keycloakUrl) return false;
  const isQa = process.env.ENV === 'qa';
  const keycloakUrl = (isQa ? process.env.KEYCLOAK_QA_URL : process.env.KEYCLOAK_DEV_URL)?.replace(
    /\/$/,
    ''
  );
  if (!keycloakUrl) return false;
  const realm =
    (isQa ? process.env.KEYCLOAK_QA_REALM : process.env.KEYCLOAK_DEV_REALM) ?? (isQa ? QA_REALM : REALM);
  const clientId =
    (isQa ? process.env.KEYCLOAK_QA_CLIENT_ID : process.env.KEYCLOAK_DEV_CLIENT_ID) ?? CLIENT_ID;
  try {
    const token = await fetchKeycloakToken(
      keycloakUrl,
      realm,
      clientId,
      TEST_USERNAME,
      TEST_PASSWORD
    );
    const next = { ...env, bearerToken: token };
    writeFileSync(join(process.cwd(), AUTH_ENV_FILE), JSON.stringify(next));
    invalidateAuthEnvCache();
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns headers to attach to requests when running with auth.
 * When .test-auth-env.json exists and has bearerToken, returns { Authorization: 'Bearer <token>' }; otherwise {}.
 */
export function getAuthHeaders(): Record<string, string> {
  const env = readAuthEnv();
  if (env?.bearerToken) return { Authorization: `Bearer ${env.bearerToken}` };
  return {};
}

/**
 * Base URL for the app. When AUTH_ENABLED=true and .test-auth-env.json exists, use its baseUrl (auth server on 3301 / QA 3500); otherwise http://localhost:PORT.
 */
export function getTestAuthBaseUrl(): string {
  if (process.env.AUTH_ENABLED === 'true') {
    const env = readAuthEnv();
    if (env?.baseUrl) return env.baseUrl;
  }
  const port = process.env.PORT || '3300';
  return `http://localhost:${port}`;
}

/** True when server requires auth (from env, e.g. .env.dev). */
export function serverRequiresAuth(): boolean {
  return process.env.AUTH_ENABLED === 'true';
}

/** True when we have a token (e.g. .test-auth-env.json written by globalSetup). */
export function hasAuthToken(): boolean {
  return readAuthEnv()?.bearerToken != null;
}

/**
 * @deprecated Use serverRequiresAuth() and hasAuthToken() instead.
 * Kept for compatibility: true when token file present.
 */
export function isTestWithAuth(): boolean {
  return hasAuthToken();
}

/**
 * Raw Bearer token for CLI (KAIROS_BEARER_TOKEN) or other use. Undefined when not auth.
 */
export function getTestBearerToken(): string | undefined {
  return readAuthEnv()?.bearerToken ?? undefined;
}
