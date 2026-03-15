/**
 * CLI Commands Environment Variable and Error Handling Tests
 * Tests KAIROS_API_URL environment variable and error scenarios
 */

import {
  execAsync,
  execAsyncNoAuth,
  execAsyncWithConfig,
  BASE_URL,
  CLI_PATH,
  TEST_FILE,
  setupServerCheck,
  setupCliConfigWithLogin
} from './cli-commands-shared.js';
import { serverRequiresAuth } from '../utils/auth-headers.js';

const AUTH_ERROR_PATTERN = /Authentication required|Unauthorized|Bearer token invalid|expired|login|Log in/i;

describe('CLI Commands Environment & Error Tests', () => {
  let serverAvailable = false;
  let configHome: string | null = null;

  beforeAll(async () => {
    serverAvailable = await setupServerCheck();
    configHome = await setupCliConfigWithLogin();
  }, 60000);

  describe('CLI via npm script', () => {
    test('npm run cli -- search with --url returns choices when server is up', async () => {
      if (!serverAvailable || !configHome) return;

      const { stdout } = await execAsync(
        `npm run cli --silent -- --url ${BASE_URL} search "test query"`,
        { timeout: 20000 },
        configHome
      );
      const result = JSON.parse(stdout.trim());
      expect(result).toHaveProperty('must_obey');
      expect(result).toHaveProperty('choices');
    }, 25000);
  });

  describe('KAIROS_API_URL environment variable', () => {
    test('search uses KAIROS_API_URL environment variable', async () => {
      if (!serverAvailable || !configHome) return;

      const { stdout, stderr } = await execAsync(
        `KAIROS_API_URL=${BASE_URL} node ${CLI_PATH} search "test query"`,
        undefined,
        configHome
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      // V2 unified response shape
      expect(result).toHaveProperty('must_obey');
      expect(result).toHaveProperty('choices');
      expect(result).toHaveProperty('choices');
    }, 30000);

    test('begin uses KAIROS_API_URL environment variable with URI', async () => {
      if (!serverAvailable || !configHome) return;

      // Mint test protocol then search to get a valid URI (no longer rely on built-in mem docs)
      await execAsync(
        `KAIROS_API_URL=${BASE_URL} node ${CLI_PATH} mint --force "${TEST_FILE}"`,
        undefined,
        configHome
      );
      const searchResult = await execAsync(
        `KAIROS_API_URL=${BASE_URL} node ${CLI_PATH} search "Minimal CLI Test Document"`,
        undefined,
        configHome
      );
      const searchData = JSON.parse(searchResult.stdout);
      // V2: extract URI from choices array (first match)
      const matchChoice = Array.isArray(searchData.choices)
        ? searchData.choices.find((c: any) => c.role === 'match')
        : null;
      const uri = matchChoice?.uri;
      expect(uri).toBeDefined();

      const { stdout, stderr } = await execAsync(
        `KAIROS_API_URL=${BASE_URL} node ${CLI_PATH} begin "${uri}"`,
        undefined,
        configHome
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      // V2: next_action replaces protocol_status
      expect(result).toHaveProperty('must_obey');
      expect(result).toHaveProperty('next_action');
      expect(result).toHaveProperty('current_step');
    }, 30000);

    test('mint uses KAIROS_API_URL environment variable', async () => {
      if (!serverAvailable || !configHome) return;

      // Use --force to handle case where chain already exists from previous test runs
      const { stdout, stderr } = await execAsync(
        `KAIROS_API_URL=${BASE_URL} node ${CLI_PATH} mint --force "${TEST_FILE}"`,
        undefined,
        configHome
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('status');
    }, 30000);

    test('--url parameter overrides KAIROS_API_URL environment variable', async () => {
      if (!serverAvailable || !configHome) return;

      // Set env var to wrong URL, but --url should override
      const { stdout, stderr } = await execAsync(
        `KAIROS_API_URL=http://wrong-url:9999 node ${CLI_PATH} search --url ${BASE_URL} "test query"`,
        undefined,
        configHome
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      // V2 unified response shape
      expect(result).toHaveProperty('must_obey');
      expect(result).toHaveProperty('choices');
      expect(result).toHaveProperty('choices');
    }, 30000);
  });

  describe('Auth required (no token)', () => {
    test('search without token fails with auth message when server requires auth', async () => {
      if (!serverAvailable || !serverRequiresAuth()) return;

      try {
        await execAsyncNoAuth(
          `node ${CLI_PATH} search --url ${BASE_URL} "test query"`,
          { timeout: 15000 }
        );
        expect('CLI should have exited with auth error').toBe(false);
      } catch (err: unknown) {
        const e = err as { code?: number; stdout?: string; stderr?: string };
        expect(e.code).not.toBe(0);
        const out = [e.stdout, e.stderr].filter(Boolean).join('\n');
        expect(out).toMatch(AUTH_ERROR_PATTERN);
      }
    }, 20000);

    test('search with invalid token in config fails with auth message when server requires auth', async () => {
      if (!serverAvailable || !serverRequiresAuth()) return;

      try {
        await execAsyncWithConfig(
          `node ${CLI_PATH} search --url ${BASE_URL} "test query"`,
          { KAIROS_API_URL: BASE_URL, KAIROS_BEARER_TOKEN: 'invalid-token' },
          { timeout: 15000 }
        );
        expect('CLI should have exited with auth error').toBe(false);
      } catch (err: unknown) {
        const e = err as { code?: number; stdout?: string; stderr?: string };
        expect(e.code).not.toBe(0);
        const out = [e.stdout, e.stderr].filter(Boolean).join('\n');
        expect(out).toMatch(AUTH_ERROR_PATTERN);
      }
    }, 20000);
  });

  describe('Error handling with --url', () => {
    test('search fails with invalid --url', async () => {
      if (!serverAvailable || !configHome) return;

      await expect(
        execAsync(`node ${CLI_PATH} search --url http://invalid-url:9999 "test query"`, undefined, configHome)
      ).rejects.toThrow();
    }, 30000);

    test('begin fails with invalid --url', async () => {
      if (!serverAvailable || !configHome) return;

      // URI can be any; we are asserting the client rejects when server URL is invalid
      await expect(
        execAsync(
          `node ${CLI_PATH} begin --url http://invalid-url:9999 "kairos://mem/00000000-0000-0000-0000-000000000000"`,
          undefined,
          configHome
        )
      ).rejects.toThrow();
    }, 30000);

    test('mint fails with invalid --url', async () => {
      if (!serverAvailable || !configHome) return;

      await expect(
        execAsync(`node ${CLI_PATH} mint --url http://invalid-url:9999 "${TEST_FILE}"`, undefined, configHome)
      ).rejects.toThrow();
    }, 30000);

    test('next fails with invalid --url', async () => {
      if (!serverAvailable || !configHome) return;

      const testUri = 'kairos://mem/00000000-0000-0000-0000-000000000000';
      await expect(
        execAsync(`node ${CLI_PATH} next --url http://invalid-url:9999 "${testUri}"`, undefined, configHome)
      ).rejects.toThrow();
    }, 30000);
  });
});

