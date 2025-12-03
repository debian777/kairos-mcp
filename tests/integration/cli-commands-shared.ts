/**
 * Shared utilities for CLI command tests
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { waitForHealthCheck } from '../utils/health-check.js';
import { join } from 'path';

export const execAsync = promisify(exec);

export const APP_PORT = process.env.PORT || '3300';
export const BASE_URL = `http://localhost:${APP_PORT}`;
export const CLI_PATH = join(process.cwd(), 'dist/cli/index.js');
export const TEST_FILE = join(process.cwd(), 'tests/test-data/AI_CODING_RULES.md');

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

