/**
 * Jest globalTeardown when AUTH_ENABLED=true.
 * Stops KAIROS server and Keycloak container using .test-auth-state.json.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const AUTH_STATE_FILE = '.test-auth-state.json';

interface AuthState {
  containerId?: string;
  serverPid?: number | null;
}

export default async function globalTeardown(): Promise<void> {
  if (process.env.AUTH_ENABLED !== 'true') return;

  const path = join(process.cwd(), AUTH_STATE_FILE);
  if (!existsSync(path)) return;

  let state: AuthState;
  try {
    state = JSON.parse(readFileSync(path, 'utf-8')) as AuthState;
  } catch {
    return;
  }

  if (state.serverPid) {
    try {
      process.kill(state.serverPid, 'SIGTERM');
    } catch {
      // process may already be gone
    }
  }

  if (state.containerId) {
    try {
      execSync(`docker stop ${state.containerId}`, { stdio: 'ignore' });
    } catch {
      // container may already be stopped
    }
  }
}
