/**
 * CLI auth E2E: browser login only (no --token). Runs `kairos login --url <base> --no-browser`;
 * CLI prints the auth URL to stdout, we drive Keycloak via Playwright, then assert token
 * storage, search, logout, search-fails.
 *
 * Requires: dev server + Keycloak (npm run dev:deploy), kairos-cli client. User/pass: TEST_USERNAME,
 * TEST_PASSWORD from auth-headers (env TEST_USERNAME/TEST_PASSWORD or kairos-tester/kairos-tester-secret).
 * Run: npm run dev:deploy && npm run dev:test -- tests/integration/cli-auth-browser-login.e2e.test.ts
 *
 * On failure, check reports/ for e2e-cli-auth-failure-*.png and *.html.
 */

import { spawn, exec, execSync } from 'child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { waitForHealthCheck } from '../utils/health-check.js';
import {
  getTestAuthBaseUrl,
  serverRequiresAuth,
  TEST_USERNAME,
  TEST_PASSWORD
} from '../utils/auth-headers.js';
import { keycloakHasKairosCliClient, saveE2EDiagnostics } from '../utils/cli-auth-e2e-utils.js';

const BASE_URL = getTestAuthBaseUrl();
const CLI_PATH = join(process.cwd(), 'dist/cli/index.js');

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
          code: err ? (err as Error & { code?: number }).code : 0
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

/** Parse callback port from redirect_uri in the auth URL. */
function callbackPortFromAuthUrl(authUrl: string): number | null {
  try {
    const u = new URL(authUrl);
    const redirectUri = u.searchParams.get('redirect_uri');
    if (!redirectUri) return null;
    const m = redirectUri.match(/^http:\/\/localhost:(\d+)\//);
    return m ? parseInt(m[1], 10) : null;
  } catch {
    return null;
  }
}

/**
 * Spawn `kairos --url <base> login --no-browser` so the CLI only prints the auth URL to
 * stdout (no browser opened). Captures URL from stdout and returns it.
 */
async function spawnLoginAndCaptureAuthUrl(
  configHome: string,
  processTracker: Array<{ proc: ReturnType<typeof spawn> }>
): Promise<{
  authUrl: string;
  exitPromise: Promise<number | null>;
  callbackPort: number;
}> {
  return new Promise((resolve, reject) => {
    const env = { XDG_CONFIG_HOME: configHome };
    const proc = spawn('node', [CLI_PATH, '--url', BASE_URL, 'login', '--no-browser'], {
      env: { ...process.env, ...env }
    });
    processTracker.push({ proc });

    let settled = false;
    const stderrChunks: Buffer[] = [];
    let stdoutBuf = '';
    proc.stderr?.on('data', (d: Buffer) => {
      stderrChunks.push(d);
    });
    proc.stdout?.on('data', (d: Buffer) => {
      if (settled) return;
      stdoutBuf += d.toString('utf-8');
      const line = stdoutBuf.split(/\r?\n/)[0]?.trim() ?? '';
      // Require full auth URL (CLI prints one line with redirect_uri=)
      if (/^https?:\/\//.test(line) && line.includes('redirect_uri=')) {
        settled = true;
        const authUrl = line;
        const callbackPort = callbackPortFromAuthUrl(authUrl);
        if (callbackPort == null) {
          proc.kill('SIGKILL');
          reject(new Error('Could not parse callback port from auth URL'));
          return;
        }
        const exitPromise = Promise.race<number | null>([
          new Promise<number | null>((r) => proc.once('close', r)),
          new Promise<number | null>((r) =>
            setTimeout(() => {
              proc.kill('SIGKILL');
              r(1);
            }, 30000)
          )
        ]);
        resolve({ authUrl, exitPromise, callbackPort });
      }
    });
    proc.on('error', () => {
      if (!settled) {
        settled = true;
        reject(new Error('CLI process failed to start'));
      }
    });
    proc.on('close', (code) => {
      if (!settled) {
        settled = true;
        const stderr = Buffer.concat(stderrChunks).toString('utf-8').trim();
        reject(new Error(`CLI login exited with code ${code} before URL was printed. stderr: ${stderr}`));
      }
    });
  });
}

const describeWhenAuth = serverRequiresAuth() ? describe : describe.skip;

describeWhenAuth('CLI auth (browser login only, no --token)', () => {
  let configHome: string;
  const spawnedProcesses: Array<{ proc: ReturnType<typeof spawn> }> = [];

  beforeAll(async () => {
    configHome = mkdtempSync(join(tmpdir(), 'kairos-cli-browser-e2e-'));

    await waitForHealthCheck({ url: `${BASE_URL}/health`, timeoutMs: 60000, intervalMs: 500 });

    const script = join(process.cwd(), 'scripts', 'configure-keycloak-realms.py');
    if (!existsSync(script)) {
      throw new Error(
        'CLI auth E2E requires scripts/configure-keycloak-realms.py. kairos-cli client must exist in Keycloak.'
      );
    }
    if (!process.env.KEYCLOAK_ADMIN_PASSWORD) {
      throw new Error(
        'CLI auth E2E requires KEYCLOAK_ADMIN_PASSWORD to verify kairos-cli client in Keycloak.'
      );
    }

    const keycloakUrl = /^https?:\/\/keycloak:/.test(process.env.KEYCLOAK_URL ?? '')
      ? 'http://localhost:8080'
      : process.env.KEYCLOAK_URL || 'http://localhost:8080';

    execSync(`python3 "${script}"`, {
      stdio: 'pipe',
      env: { ...process.env, KEYCLOAK_URL: keycloakUrl },
      cwd: process.cwd()
    });

    const hasClient = await keycloakHasKairosCliClient(keycloakUrl, process.env.KEYCLOAK_ADMIN_PASSWORD);
    if (!hasClient) {
      throw new Error(
        `kairos-cli client not found in Keycloak kairos-dev at ${keycloakUrl}. ` +
          'Add kairos-cli to realm import or run configure-keycloak-realms.py.'
      );
    }
  }, 65000);

  afterAll(() => {
    for (const { proc } of spawnedProcesses) {
      if (!proc.killed && proc.exitCode === null) {
        try {
          proc.kill('SIGKILL');
        } catch {
          // ignore
        }
      }
    }
    spawnedProcesses.length = 0;
    if (configHome && existsSync(configHome)) {
      rmSync(configHome, { recursive: true });
    }
  });

  test('browser login: Keycloak form -> callback -> token stored, search works', async () => {

    const { authUrl, exitPromise, callbackPort } = await spawnLoginAndCaptureAuthUrl(
      configHome,
      spawnedProcesses
    );

    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    let page;
    try {
      page = await browser.newPage();
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
      await page.goto(authUrl, { waitUntil: 'load', timeout: 20000 });
      await page.waitForLoadState('networkidle').catch(() => {});

      const bodyText = await page.locator('body').innerText().catch(() => '');
      if (/Client not found|Invalid redirect uri|client not found/i.test(bodyText)) {
        await saveE2EDiagnostics(page, authUrl, new Error(`Keycloak error: ${bodyText.slice(0, 200)}`));
        throw new Error(
          `Keycloak returned an error (see reports/). Ensure realm and kairos-cli client exist: KEYCLOAK_ADMIN_PASSWORD set and run: python3 scripts/configure-keycloak-realms.py`
        );
      }

      await page.locator('#kc-form-login').or(page.locator('form')).first().waitFor({ state: 'visible', timeout: 10000 });

      const usernameInput = page.getByLabel(/username|email/i)
        .or(page.locator('input#username'))
        .or(page.locator('input[name="username"]'))
        .or(page.locator('form input[type="text"]').first());
      const passwordInput = page.locator('input#password').or(page.locator('input[name="password"][type="password"]')).first();
      await usernameInput.waitFor({ state: 'visible', timeout: 35000 });
      await usernameInput.fill(TEST_USERNAME);
      await passwordInput.fill(TEST_PASSWORD);
      const submitButton = page.locator('input[type="submit"]')
        .or(page.locator('button[type="submit"]'))
        .or(page.locator('button[name="login"]'))
        .or(page.getByRole('button', { name: /sign in|log in/i }))
        .first();
      await submitButton.click();

      await page.waitForURL(
        (url) => url.origin === `http://localhost:${callbackPort}` && url.pathname.startsWith('/callback/'),
        { timeout: 15000 }
      );

      const exitCode = await Promise.race([
        exitPromise,
        new Promise<number>((resolve) => setTimeout(() => resolve(1), 30000))
      ]);
      expect(exitCode).toBe(0);
    } catch (error) {
      if (page) {
        await saveE2EDiagnostics(page, authUrl, error).catch(() => {});
        try {
          await page.close();
        } catch {
          // ignore
        }
      }
      throw error;
    } finally {
      try {
        await browser.close();
      } catch {
        // ignore
      }
    }

    const config = readConfigFromDir(configHome);
    expect(config.bearerToken).toBeDefined();
    expect(config.KAIROS_API_URL).toBe(BASE_URL);

    const searchResult = await runCli(`--url ${BASE_URL} search "test"`, { XDG_CONFIG_HOME: configHome });
    expect(searchResult.code).toBe(0);
    const data = JSON.parse(searchResult.stdout);
    expect(data).toHaveProperty('choices');
  }, 120000);

  test('logout clears token from config', async () => {
    const configBefore = readConfigFromDir(configHome);
    expect(configBefore.bearerToken).toBeDefined();

    const logoutResult = await runCli(`--url ${BASE_URL} logout`, { XDG_CONFIG_HOME: configHome });
    expect(logoutResult.code).toBe(0);
    expect(logoutResult.stdout).toMatch(/Token cleared/i);

    const configAfter = readConfigFromDir(configHome);
    expect(configAfter.bearerToken).toBeUndefined();
    expect(configAfter.KAIROS_API_URL).toBe(BASE_URL);
  }, 15000);

  test('search without token after logout fails with auth message', async () => {
    // KAIROS_CLI_NO_AUTO_LOGIN=1 so CLI does not open browser; fails fast with auth error
    const searchResult = await Promise.race([
      runCli(`--url ${BASE_URL} search "test"`, {
        XDG_CONFIG_HOME: configHome,
        KAIROS_CLI_NO_AUTO_LOGIN: '1'
      }),
      new Promise<{ stdout: string; stderr: string; code?: number }>((_, reject) =>
        setTimeout(() => reject(new Error('CLI timed out after 12s (expected auth error)')), 12000)
      )
    ]);
    expect(searchResult.code).not.toBe(0);
    expect(searchResult.stderr || searchResult.stdout).toMatch(
      /Authentication required|Unauthorized|login|Log in/i
    );
  }, 15000);
});
