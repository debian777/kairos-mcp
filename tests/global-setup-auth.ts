/**
 * Jest globalSetup when AUTH_ENABLED=true.
 * Provisions Keycloak (if needed) and test token; app must already be running (e.g. npm run dev:deploy).
 * Cleans stale auth state at start so tests never rely on old tokens or wrong baseUrl.
 */

import { execSync } from 'child_process';
import { writeFileSync, existsSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import {
  startKeycloakWithTestUser,
  useExistingKeycloakFromEnv
} from './utils/keycloak-container';

/** Env suffix for test auth file (e.g. .test-auth-env.dev.json). */
function getEnvSuffix(): string {
  return 'dev';
}

function getAuthEnvFile(root: string): string {
  return join(root, `.test-auth-env.${getEnvSuffix()}.json`);
}
function getAuthStateFile(root: string): string {
  return join(root, `.test-auth-state.${getEnvSuffix()}.json`);
}

/** Decode JWT payload (no verify) to get space for kairos-tester: user:realm:sub */
function spaceIdFromToken(token: string): string | undefined {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return undefined;
    const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString()) as { sub?: string; realm?: string; iss?: string };
    const sub = payload.sub;
    if (!sub || typeof sub !== 'string') return undefined;
    let realm = payload.realm;
    if (!realm && typeof payload.iss === 'string') {
      const m = payload.iss.match(/\/realms\/([^/]+)/);
      realm = m ? m[1] : 'default';
    }
    realm = realm ?? 'default';
    return `user:${realm}:${sub}`;
  } catch {
    return undefined;
  }
}

interface AuthState {
  containerId?: string;
  serverPid?: number | null;
}

function cleanStaleAuthState(root: string): void {
  const statePath = getAuthStateFile(root);
  if (existsSync(statePath)) {
    try {
      const state = JSON.parse(readFileSync(statePath, 'utf-8')) as AuthState;
      if (state.serverPid) {
        try {
          process.kill(state.serverPid, 'SIGTERM');
        } catch {
          // already gone
        }
      }
      if (state.containerId) {
        try {
          execSync(`docker stop ${state.containerId}`, { stdio: 'ignore' });
        } catch {
          // already stopped
        }
      }
    } catch {
      // ignore parse/read errors
    }
    try {
      unlinkSync(statePath);
    } catch {
      // ignore
    }
  }
  const envPath = getAuthEnvFile(root);
  if (existsSync(envPath)) {
    try {
      unlinkSync(envPath);
    } catch {
      // ignore
    }
  }
}

function loadEnv(): void {
  const root = process.cwd();
  const opts = { override: true };
  const env = process.env.ENV || 'dev';
  const envFile = join(root, `.env.${env}`);
  if (existsSync(envFile)) config({ path: envFile, ...opts });
  if (existsSync(join(root, '.env'))) config({ path: join(root, '.env'), ...opts });
}

export default async function globalSetup(): Promise<void> {
  loadEnv();
  cleanStaleAuthState(process.cwd());
  if (process.env.AUTH_ENABLED !== 'true') return;

  const port = process.env.PORT || '3300';
  const useExisting =
    process.env.KEYCLOAK_URL != null && process.env.KEYCLOAK_URL.trim() !== '';
  const baseUrl = `http://localhost:${port}`;

  const env = useExisting
    ? await useExistingKeycloakFromEnv()
    : await startKeycloakWithTestUser();
  const bearerToken = await env.getTestUserToken();
  const containerId = env.container?.getId();
  const spaceId = spaceIdFromToken(bearerToken);
  const cwd = process.cwd();
  writeFileSync(
    getAuthEnvFile(cwd),
    JSON.stringify({ bearerToken, baseUrl, keycloakUrl: env.keycloakUrl, ...(spaceId && { spaceId }) })
  );
  writeFileSync(getAuthStateFile(cwd), JSON.stringify({ containerId: containerId ?? undefined, serverPid: undefined }));
}
