/**
 * Jest globalTeardown.
 * 1. Stops Keycloak container (if started by globalSetup) using .test-auth-state.{dev,qa}.json.
 * 2. Kills the stdio child server process (if running) so Jest can exit.
 *    Without this, the child's open stdio pipes keep Jest's event loop alive,
 *    causing CI to hang for hours (--forceExit does NOT kill child processes).
 */

import { readFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

function getAuthStateFilePath(): string {
  const suffix = process.env.ENV === 'qa' ? 'qa' : 'dev';
  return join(process.cwd(), `.test-auth-state.${suffix}.json`);
}

interface AuthState {
  containerId?: string;
}

function getStdioPidFile(): string {
  return join(process.cwd(), '.test-stdio-child.pid');
}

function killStdioChild(): void {
  const pidFile = getStdioPidFile();
  if (!existsSync(pidFile)) return;
  let pid: number;
  try {
    pid = parseInt(readFileSync(pidFile, 'utf-8').trim(), 10);
  } catch {
    return;
  }
  if (!pid || isNaN(pid)) return;
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // process may already be gone
  }
  // Give the child a moment to exit gracefully, then force-kill if still alive
  setTimeout(() => {
    try { process.kill(pid, 0); } catch { return; } // check if alive
    try { process.kill(pid, 'SIGKILL'); } catch { /* ignore */ }
  }, 2000).unref();
  // Clean up the PID file
  try { unlinkSync(pidFile); } catch { /* ignore */ }
}

export default async function globalTeardown(): Promise<void> {
  // Kill stdio child process first (runs in all environments)
  killStdioChild();

  // Auth teardown: only when AUTH_ENABLED=true
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
