/**
 * Auth headers for integration tests when AUTH_ENABLED=true.
 * Reads .test-auth-env.{dev,qa}.json written by globalSetup (when server requires auth).
 * Env-specific filenames allow dev:test and qa:test to run in parallel without clobbering each other.
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

/** Same convention as global-setup-auth: ENV=qa -> .test-auth-env.qa.json, else .test-auth-env.dev.json */
function getAuthEnvFilePath(): string {
  const suffix = process.env.ENV === 'qa' ? 'qa' : 'dev';
  return join(process.cwd(), `.test-auth-env.${suffix}.json`);
}

const TEST_USERNAME = 'kairos-tester';
const TEST_PASSWORD = 'kairos-tester-secret';

interface TestAuthEnv {
  bearerToken?: string;
  baseUrl?: string;
  keycloakUrl?: string;
  /** Space of kairos-tester (user:realm:sub from token); use for kairos_search space_id so tests use actual test user scope */
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
 * Fetch a fresh Keycloak token and update the env-specific auth file.
 * Uses KEYCLOAK_URL, KEYCLOAK_REALM, KEYCLOAK_CLIENT_ID from loaded .env. Returns true if refreshed.
 */
export async function refreshTestAuthToken(): Promise<boolean> {
  if (process.env.AUTH_ENABLED !== 'true') return false;
  const env = readAuthEnv();
  if (!env?.baseUrl || !env?.keycloakUrl) return false;
  const keycloakUrl = process.env.KEYCLOAK_URL?.replace(/\/$/, '');
  const realm = process.env.KEYCLOAK_REALM?.trim();
  const clientId = process.env.KEYCLOAK_CLIENT_ID?.trim();
  if (!keycloakUrl || !realm || !clientId) return false;
  try {
    const token = await fetchKeycloakToken(
      keycloakUrl,
      realm,
      clientId,
      TEST_USERNAME,
      TEST_PASSWORD
    );
    const next = { ...env, bearerToken: token };
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
 * Base URL for the app. When AUTH_ENABLED=true and the env-specific auth file exists, use its baseUrl (auth server on 3300 / QA 3500); otherwise http://localhost:PORT.
 */
export function getTestAuthBaseUrl(): string {
  if (process.env.AUTH_ENABLED === 'true') {
    const env = readAuthEnv();
    if (env?.baseUrl) return env.baseUrl;
  }
  const port = process.env.PORT || '3300';
  return `http://localhost:${port}`;
}

/** True when server requires auth (from env, e.g. .env). */
export function serverRequiresAuth(): boolean {
  return process.env.AUTH_ENABLED === 'true';
}

/** True when we have a token (e.g. env-specific auth file written by globalSetup). */
export function hasAuthToken(): boolean {
  return readAuthEnv()?.bearerToken != null;
}

/** Space ID of kairos-tester (user:realm:sub) when AUTH_ENABLED and token present. Pass as space_id to kairos_search so tests use actual test user scope. */
export function getTestSpaceId(): string | undefined {
  return readAuthEnv()?.spaceId ?? undefined;
}

/**
 * Raw Bearer token for CLI (KAIROS_BEARER_TOKEN) or other use. Undefined when not auth.
 */
export function getTestBearerToken(): string | undefined {
  return readAuthEnv()?.bearerToken ?? undefined;
}
