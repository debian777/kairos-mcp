/**
 * Shared utilities for CLI command tests.
 * CLI uses config.json only (no KAIROS_BEARER_TOKEN env). Tests run "cli login --token" to create config, then run commands with that config dir.
 */

import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { waitForHealthCheck } from '../utils/health-check.js';
import { getTestAuthBaseUrl, getTestBearerToken } from '../utils/auth-headers.js';

export const BASE_URL = getTestAuthBaseUrl();
export const CLI_PATH = join(process.cwd(), 'dist/cli/index.js');
export const TEST_FILE = join(process.cwd(), 'tests/test-data/cli-minimal-test.md');

/** Create a config dir and run "cli login --token" so config.json is written. Returns config dir or null if no token. */
export async function setupCliConfigWithLogin(): Promise<string | null> {
  const token = process.env.AUTH_ENABLED === 'true' ? getTestBearerToken() : undefined;
  if (!token) return null;
  const configHome = mkdtempSync(join(tmpdir(), 'kairos-cli-config-'));
  const env = { ...process.env, XDG_CONFIG_HOME: configHome };
  await new Promise<void>((resolve, reject) => {
    execFile('node', [CLI_PATH, 'login', '--token', token, '--url', BASE_URL], { env, timeout: 15000 }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  return configHome;
}

function envWithConfigHome(configHome: string | null): NodeJS.ProcessEnv {
  const env = { ...process.env };
  if (configHome) env.XDG_CONFIG_HOME = configHome;
  return env;
}

/** Run a CLI command. Uses configHome from setupCliConfigWithLogin (config written by "cli login --token"). No token env. */
export async function execAsync(
  command: string,
  options?: { timeout?: number },
  configHome?: string | null
): Promise<{ stdout: string; stderr: string }> {
  const env = envWithConfigHome(configHome ?? null);
  return promisify(exec)(command, { env, ...options }) as Promise<{ stdout: string; stderr: string }>;
}

/** Create an empty config dir (no login). Use to assert auth is required. */
function emptyConfigEnv(): NodeJS.ProcessEnv {
  const configHome = mkdtempSync(join(tmpdir(), 'kairos-cli-noauth-'));
  return { ...process.env, XDG_CONFIG_HOME: configHome };
}

/** Run a CLI command with empty config (no token). Rejects on non-zero exit. Use to test auth failure. */
export async function execAsyncNoAuth(
  command: string,
  options?: { timeout?: number }
): Promise<{ stdout: string; stderr: string }> {
  return promisify(exec)(command, { env: emptyConfigEnv(), ...options }) as Promise<{ stdout: string; stderr: string }>;
}

/** Write config.json into a temp dir (for invalid-token test). Then run command with that XDG_CONFIG_HOME. */
export async function execAsyncWithConfig(
  command: string,
  config: { KAIROS_API_URL?: string; KAIROS_BEARER_TOKEN?: string },
  options?: { timeout?: number }
): Promise<{ stdout: string; stderr: string }> {
  const configHome = mkdtempSync(join(tmpdir(), 'kairos-cli-custom-'));
  const dir = join(configHome, 'kairos');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'config.json'), JSON.stringify(config, null, 2), { mode: 0o600 });
  return promisify(exec)(command, { env: { ...process.env, XDG_CONFIG_HOME: configHome }, ...options }) as Promise<{
    stdout: string;
    stderr: string;
  }>;
}

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

