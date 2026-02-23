/**
 * Jest globalSetup when AUTH_ENABLED=true.
 * Dev: starts auth test server on 3301 (or uses existing Keycloak). QA: uses existing QA server on 3500, no spawn.
 */

import { spawn } from 'child_process';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import {
  startKeycloakWithTestUser,
  useExistingKeycloakFromEnv,
  useExistingKeycloakForQa
} from './utils/keycloak-container';

const AUTH_ENV_FILE = '.test-auth-env.json';
const AUTH_STATE_FILE = '.test-auth-state.json';
/** Dev: auth test server on 3301 to avoid conflict with dev server on 3300. QA uses 3500 (no spawn). */
const DEV_AUTH_TEST_PORT = 3301;
const QA_APP_PORT = 3500;

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
  if (process.env.AUTH_ENABLED !== 'true') return;

  const isQa = process.env.ENV === 'qa';

  if (isQa) {
    const baseUrl = `http://localhost:${QA_APP_PORT}`;
    const env = await useExistingKeycloakForQa();
    const bearerToken = await env.getTestUserToken();
    writeFileSync(
      join(process.cwd(), AUTH_ENV_FILE),
      JSON.stringify({ bearerToken, baseUrl, keycloakUrl: env.keycloakUrl })
    );
    writeFileSync(
      join(process.cwd(), AUTH_STATE_FILE),
      JSON.stringify({ containerId: undefined, serverPid: undefined })
    );
    return;
  }

  const useExisting =
    process.env.KEYCLOAK_DEV_URL != null && process.env.KEYCLOAK_DEV_URL.trim() !== '';
  const baseUrl = `http://localhost:${DEV_AUTH_TEST_PORT}`;

  const env = useExisting
    ? await useExistingKeycloakFromEnv()
    : await startKeycloakWithTestUser();
  const bearerToken = await env.getTestUserToken();
  const containerId = env.container?.getId();

  const serverEnv: Record<string, string> = {
    ...process.env,
    AUTH_ENABLED: 'true',
    KEYCLOAK_DEV_URL: env.keycloakUrl,
    KEYCLOAK_DEV_REALM: env.realm,
    KEYCLOAK_DEV_CLIENT_ID: env.clientId,
    AUTH_CALLBACK_BASE_URL: baseUrl,
    SESSION_SECRET: 'test-secret-min-32-chars-for-signing-cookies',
    AUTH_MODE: 'oidc_bearer',
    AUTH_TRUSTED_ISSUERS: `${env.keycloakUrl}/realms/${env.realm}`,
    AUTH_ALLOWED_AUDIENCES: env.clientId,
    PORT: String(DEV_AUTH_TEST_PORT)
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

  writeFileSync(
    join(process.cwd(), AUTH_ENV_FILE),
    JSON.stringify({ bearerToken, baseUrl, keycloakUrl: env.keycloakUrl })
  );
  writeFileSync(
    join(process.cwd(), AUTH_STATE_FILE),
    JSON.stringify({ containerId: containerId ?? undefined, serverPid })
  );
}
