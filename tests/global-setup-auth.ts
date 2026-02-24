/**
 * Jest globalSetup when AUTH_ENABLED=true.
 * Dev: starts auth test server on PORT (from .env.dev). QA: uses existing server on PORT (from .env.qa), no spawn.
 * Cleans stale auth state at start so tests never rely on old tokens or wrong baseUrl.
 */

import { spawn, execSync } from 'child_process';
import { writeFileSync, existsSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import {
  startKeycloakWithTestUser,
  useExistingKeycloakFromEnv,
  useExistingKeycloakForQa
} from './utils/keycloak-container';

const AUTH_ENV_FILE = '.test-auth-env.json';
const AUTH_STATE_FILE = '.test-auth-state.json';

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
  const statePath = join(root, AUTH_STATE_FILE);
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
  const envPath = join(root, AUTH_ENV_FILE);
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
  if (existsSync(join(root, '.env'))) config({ path: join(root, '.env') });
  if (process.env.ENV === 'qa') {
    if (existsSync(join(root, '.env.qa'))) config({ path: join(root, '.env.qa') });
  } else {
    if (existsSync(join(root, '.env.dev'))) config({ path: join(root, '.env.dev') });
  }
}

async function waitForServer(baseUrl: string, timeoutMs = 60_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server did not become healthy at ${baseUrl}/health within ${timeoutMs}ms`);
}

export default async function globalSetup(): Promise<void> {
  loadEnv();
  cleanStaleAuthState(process.cwd());
  if (process.env.AUTH_ENABLED !== 'true') return;

  const isQa = process.env.ENV === 'qa';
  const port = process.env.PORT || (isQa ? '3500' : '3300');

  if (isQa) {
    const baseUrl = `http://localhost:${port}`;
    const keycloakUrl = process.env.KEYCLOAK_URL?.trim() ?? '';
    if (!keycloakUrl) {
      // No Keycloak configured for QA: write baseUrl only so tests hit QA app; auth tests accept 200/401
      writeFileSync(
        join(process.cwd(), AUTH_ENV_FILE),
        JSON.stringify({ baseUrl })
      );
      writeFileSync(
        join(process.cwd(), AUTH_STATE_FILE),
        JSON.stringify({ containerId: undefined, serverPid: undefined })
      );
      return;
    }
    const env = await useExistingKeycloakForQa();
    const bearerToken = await env.getTestUserToken();
    const spaceId = spaceIdFromToken(bearerToken);
    writeFileSync(
      join(process.cwd(), AUTH_ENV_FILE),
      JSON.stringify({ bearerToken, baseUrl, keycloakUrl: env.keycloakUrl, ...(spaceId && { spaceId }) })
    );
    writeFileSync(
      join(process.cwd(), AUTH_STATE_FILE),
      JSON.stringify({ containerId: undefined, serverPid: undefined })
    );
    return;
  }

  const useExisting =
    process.env.KEYCLOAK_URL != null && process.env.KEYCLOAK_URL.trim() !== '';
  const baseUrl = `http://localhost:${port}`;

  const env = useExisting
    ? await useExistingKeycloakFromEnv()
    : await startKeycloakWithTestUser();
  const bearerToken = await env.getTestUserToken();
  const containerId = env.container?.getId();

  const serverEnv: Record<string, string> = {
    ...process.env,
    AUTH_ENABLED: 'true',
    KEYCLOAK_URL: env.keycloakUrl,
    KEYCLOAK_REALM: env.realm,
    KEYCLOAK_CLIENT_ID: env.clientId,
    AUTH_CALLBACK_BASE_URL: baseUrl,
    SESSION_SECRET: 'test-secret-min-32-chars-for-signing-cookies',
    AUTH_MODE: 'oidc_bearer',
    AUTH_TRUSTED_ISSUERS: `${env.keycloakUrl}/realms/${env.realm}`,
    AUTH_ALLOWED_AUDIENCES: env.clientId,
    PORT: port
  };

  const serverPath = join(process.cwd(), 'dist/index.js');
  const server = spawn(process.execPath, [serverPath], {
    env: serverEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: process.cwd()
  });

  let serverPid: number | null = server.pid ?? null;
  server.on('error', (err) => {
    console.error('Auth test server spawn error:', err);
  });
  server.stderr?.on('data', (d) => process.stderr.write(d));

  try {
    await waitForServer(baseUrl);
  } catch (err) {
    server.kill('SIGTERM');
    throw err;
  }

  const spaceId = spaceIdFromToken(bearerToken);
  writeFileSync(
    join(process.cwd(), AUTH_ENV_FILE),
    JSON.stringify({ bearerToken, baseUrl, keycloakUrl: env.keycloakUrl, ...(spaceId && { spaceId }) })
  );
  writeFileSync(
    join(process.cwd(), AUTH_STATE_FILE),
    JSON.stringify({ containerId: containerId ?? undefined, serverPid })
  );
}
