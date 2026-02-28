/**
 * Jest globalTeardown when AUTH_ENABLED=true.
 * Stops Keycloak container (if started by globalSetup) using .test-auth-state.{dev,qa}.json.
 * App is not started by tests, so no server is stopped here.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

function getAuthStateFilePath(): string {
  const suffix = process.env.ENV === 'qa' ? 'qa' : 'dev';
  return join(process.cwd(), `.test-auth-state.${suffix}.json`);
}

interface AuthState {
  containerId?: string;
}

export default async function globalTeardown(): Promise<void> {
  if (process.env.AUTH_ENABLED !== 'true') return;

  const path = getAuthStateFilePath();
  if (!existsSync(path)) return;

  let state: AuthState;
  try {
    state = JSON.parse(readFileSync(path, 'utf-8')) as AuthState;
  } catch {
    return;
  }

  if (state.containerId) {
    try {
      execSync(`docker stop ${state.containerId}`, { stdio: 'ignore' });
    } catch {
      // container may already be stopped
    }
  }
}
