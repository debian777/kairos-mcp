/**
 * Shared utilities for CLI command tests
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { waitForHealthCheck } from '../utils/health-check.js';
import { getTestAuthBaseUrl, getTestBearerToken } from '../utils/auth-headers.js';
import { join } from 'path';

const execOpts = () => ({
  env: {
    ...process.env,
    KAIROS_BEARER_TOKEN:
      process.env.AUTH_ENABLED === 'true' ? (getTestBearerToken() ?? '') : ''
  }
});

/** Run a CLI command with auth env (KAIROS_BEARER_TOKEN) so child process can authenticate. */
export async function execAsync(
  command: string,
  options?: { timeout?: number }
): Promise<{ stdout: string; stderr: string }> {
  return promisify(exec)(command, { ...execOpts(), ...options }) as Promise<{
    stdout: string;
    stderr: string;
  }>;
}

export const BASE_URL = getTestAuthBaseUrl();
export const CLI_PATH = join(process.cwd(), 'dist/cli/index.js');
// Use minimal test file for CLI parameter tests (faster than full AI_CODING_RULES.md)
export const TEST_FILE = join(process.cwd(), 'tests/test-data/cli-minimal-test.md');

export async function setupServerCheck() {
  let serverAvailable = false;
  try {
    await waitForHealthCheck({
      url: `${BASE_URL}/health`,
      timeoutMs: 60000,
      intervalMs: 500
    });
    serverAvailable = true;
  } catch (_error) {
    serverAvailable = false;
    console.warn('Server not available, skipping CLI tests');
  }
  return serverAvailable;
}

