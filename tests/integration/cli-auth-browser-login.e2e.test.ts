/**
 * CLI auth E2E: browser login only (no --token). Spawns `kairos login` with KAIROS_LOGIN_NO_BROWSER=1,
 * drives Keycloak login via Playwright, then asserts token storage, search, logout, and search-fails.
 *
 * Requires: dev server + Keycloak (npm run dev:deploy), kairos-tester user, redirect_uri
 * kairos-cli redirect URIs include localhost:38474–38476 (E2E tries these in order). Run: npm run dev:deploy && npm run dev:test -- tests/integration/cli-auth-browser-login.e2e.test.ts
 */

import { spawn, exec } from 'child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { waitForHealthCheck } from '../utils/health-check.js';
import {
  getTestAuthBaseUrl,
  serverRequiresAuth,
  hasAuthToken,
  TEST_USERNAME,
  TEST_PASSWORD
} from '../utils/auth-headers.js';

const BASE_URL = getTestAuthBaseUrl();
const CLI_PATH = join(process.cwd(), 'dist/cli/index.js');
/** E2E tries these ports in order until one is free. All must be in Keycloak kairos-cli redirect URIs. */
const E2E_CALLBACK_PORTS = [38474, 38475, 38476, 38477, 38478, 38479];

function runCli(
  args: string,
  env: NodeJS.ProcessEnv = {}
): Promise<{ stdout: string; stderr: string; code?: number }> {
  return new Promise((resolve) => {
    exec(
      `node ${CLI_PATH} ${args}`,
      { env: { ...process.env, ...env } },
      (err, stdout, stderr) => {
        resolve({
          stdout: stdout ?? '',
          stderr: stderr ?? '',
          code: err ? (err as NodeJS.ExecException & { code?: number }).code : 0
        });
      }
    );
  });
}

function readConfigFromDir(configHome: string): Record<string, unknown> {
  const configPath = join(configHome, 'kairos', 'config.json');
  if (!existsSync(configPath)) return {};
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Spawn CLI login (no browser); try E2E_CALLBACK_PORTS until one binds. Returns auth URL, exit promise, and the port used. */
async function spawnLoginAndGetAuthUrl(configHome: string): Promise<{
  authUrl: string;
  exitPromise: Promise<number | null>;
  callbackPort: number;
}> {
  const tryPort = (port: number): Promise<{ authUrl: string; exitPromise: Promise<number | null> } | 'port_in_use' | 'timeout'> => {
    return new Promise((resolve) => {
      const env = {
        XDG_CONFIG_HOME: configHome,
        KAIROS_LOGIN_NO_BROWSER: '1',
        KAIROS_LOGIN_CALLBACK_PORT: String(port)
      };
      const proc = spawn('node', [CLI_PATH, '--url', BASE_URL, 'login'], { env: { ...process.env, ...env } });
      let settled = false;
      const stderrChunks: Buffer[] = [];
      proc.stdout?.on('data', (d: Buffer) => {
        const line = d.toString().trim();
        const match = line.match(/^(https?:\/\/[^\s]+)/);
        if (match && !settled) {
          settled = true;
          // Create exitPromise with timeout to prevent hangs
          const exitPromise = Promise.race<number | null>([
            new Promise<number | null>((r) => proc.on('close', r)),
            new Promise<number | null>((r) => setTimeout(() => {
              proc.kill('SIGKILL');
              r(1); // Timeout = error exit code
            }, 30000))
          ]);
          resolve({
            authUrl: match[1],
            exitPromise
          });
        }
      });
      proc.stderr?.on('data', (d: Buffer) => { stderrChunks.push(d); });
      proc.on('error', () => {
        if (!settled) { settled = true; resolve('port_in_use'); }
      });
      proc.on('close', (code) => {
        if (!settled) {
          settled = true;
          const stderr = Buffer.concat(stderrChunks).toString('utf-8').trim();
          if (code === 1 && /port.*in use/i.test(stderr)) resolve('port_in_use');
          else resolve('timeout');
        }
      });
      setTimeout(() => {
        if (!settled) {
          settled = true;
          proc.kill('SIGTERM');
          // Force kill after a short grace period
          setTimeout(() => {
            if (!proc.killed) {
              proc.kill('SIGKILL');
            }
          }, 2000);
          resolve('timeout');
        }
      }, 20000);
    });
  };

  for (const port of E2E_CALLBACK_PORTS) {
    const result = await tryPort(port);
    if (result !== 'port_in_use' && result !== 'timeout') {
      return { ...result, callbackPort: port };
    }
  }
  throw new Error(
    `CLI did not print auth URL; tried ports ${E2E_CALLBACK_PORTS.join(', ')} (all in use or timeout)`
  );
}

const describeWhenAuth = serverRequiresAuth() && hasAuthToken() ? describe : describe.skip;
const env = (configHome: string) => ({ XDG_CONFIG_HOME: configHome });

describeWhenAuth('CLI auth (browser login only, no --token)', () => {
  let serverAvailable = false;
  let configHome: string;

  beforeAll(async () => {
    configHome = mkdtempSync(join(tmpdir(), 'kairos-cli-browser-e2e-'));
    try {
      await waitForHealthCheck({ url: `${BASE_URL}/health`, timeoutMs: 60000, intervalMs: 500 });
      serverAvailable = true;
    } catch {
      serverAvailable = false;
      console.warn('Server not available, skipping CLI auth E2E');
    }
  }, 65000);

  afterAll(() => {
    if (configHome && existsSync(configHome)) {
      rmSync(configHome, { recursive: true });
    }
  });

  function skipIfUnavailable(): boolean {
    if (!serverAvailable) {
      console.warn('Skipping — server not available');
      return true;
    }
    return false;
  }

  test('browser login: Keycloak form -> callback -> token stored, search works', async () => {
    if (skipIfUnavailable()) return;

    const { chromium } = await import('playwright');
    const { authUrl, exitPromise, callbackPort } = await spawnLoginAndGetAuthUrl(configHome);

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
      await page.goto(authUrl, { waitUntil: 'load', timeout: 20000 });
      await page.waitForLoadState('networkidle').catch(() => {});

      // Keycloak login form: prefer by label (works across base/keycloak/keycloak.v2), fallback to id/name
      const usernameInput = page.getByLabel(/username|email/i).or(page.locator('input#username, input[name="username"]').first());
      const passwordInput = page.getByLabel(/password/i).or(page.locator('input#password, input[name="password"]').first());
      await usernameInput.waitFor({ state: 'visible', timeout: 35000 });
      await usernameInput.fill(TEST_USERNAME);
      await passwordInput.fill(TEST_PASSWORD);
      await page.locator('input[type="submit"], button[type="submit"]').first().click();

      await page.waitForURL((url) => url.origin === `http://localhost:${callbackPort}` && url.pathname === '/callback', { timeout: 15000 });

      // Wait for exit with timeout to prevent hangs
      const exitCode = await Promise.race([
        exitPromise,
        new Promise<number>((resolve) => setTimeout(() => resolve(1), 30000))
      ]);
      expect(exitCode).toBe(0);
    } finally {
      await browser.close();
    }

    const config = readConfigFromDir(configHome);
    expect(config.KAIROS_BEARER_TOKEN).toBeDefined();
    expect(config.KAIROS_API_URL).toBe(BASE_URL);

    const searchResult = await runCli(`--url ${BASE_URL} search "test"`, env(configHome));
    expect(searchResult.code).toBe(0);
    const data = JSON.parse(searchResult.stdout);
    expect(data).toHaveProperty('choices');
  }, 45000);

  test('logout clears token from config', async () => {
    if (skipIfUnavailable()) return;
    // Depends on previous test: config already has token from browser login
    const configBefore = readConfigFromDir(configHome);
    expect(configBefore.KAIROS_BEARER_TOKEN).toBeDefined();

    const logoutResult = await runCli(`--url ${BASE_URL} logout`, env(configHome));
    expect(logoutResult.code).toBe(0);
    expect(logoutResult.stdout).toMatch(/Token cleared/i);

    const configAfter = readConfigFromDir(configHome);
    expect(configAfter.KAIROS_BEARER_TOKEN).toBeUndefined();
    expect(configAfter.KAIROS_API_URL).toBe(BASE_URL);
  }, 15000);

  test('search without token after logout fails with auth message', async () => {
    if (skipIfUnavailable()) return;
    const searchResult = await runCli(`--url ${BASE_URL} search "test"`, env(configHome));
    expect(searchResult.code).not.toBe(0);
    expect(searchResult.stderr || searchResult.stdout).toMatch(
      /Authentication required|Unauthorized|login|Log in/i
    );
  }, 15000);
});
