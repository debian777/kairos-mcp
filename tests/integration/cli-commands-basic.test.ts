/**
 * CLI Commands Basic Tests - activate, forward, and train commands
 * Tests CLI commands with --url parameter
 */

import {
  execAsync,
  execAsyncNoAuth,
  BASE_URL,
  CLI_PATH,
  TEST_FILE,
  setupServerCheck,
  setupCliConfigWithLogin
} from './cli-commands-shared.js';

describe('CLI Commands Basic --url Tests', () => {
  let serverAvailable = false;
  let cliLoggedIn = false;
  let cachedSearchUri: string | null = null;

  beforeAll(async () => {
    serverAvailable = await setupServerCheck();
    cliLoggedIn = await setupCliConfigWithLogin();
    if (serverAvailable && cliLoggedIn) {
      try {
        await execAsync(
          `node ${CLI_PATH} train --url ${BASE_URL} --force "${TEST_FILE}"`
        );
        const searchResult = await execAsync(
          `node ${CLI_PATH} activate --url ${BASE_URL} "Minimal CLI Test Document"`
        );
        const searchData = JSON.parse(searchResult.stdout);
        const matchChoice = Array.isArray(searchData.choices)
          ? searchData.choices.find((c: { role: string }) => c.role === 'match')
          : null;
        cachedSearchUri = matchChoice?.uri ?? null;
      } catch {
        cachedSearchUri = null;
      }
    }
  }, 60000);

  describe('activate command', () => {
    test('activate uses --url parameter', async () => {
      if (!serverAvailable || !cliLoggedIn) return;

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} activate --url ${BASE_URL} "test query"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      // V2 unified response shape
      expect(result).toHaveProperty('must_obey');
      expect(result).toHaveProperty('choices');
    }, 30000);

    test('activate uses -u short form', async () => {
      if (!serverAvailable || !cliLoggedIn) return;

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} activate -u ${BASE_URL} "test query"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      // V2 unified response shape
      expect(result).toHaveProperty('must_obey');
      expect(result).toHaveProperty('choices');
    }, 30000);
  });

  describe('forward command', () => {
    test('forward uses --url parameter with URI', async () => {
      if (!serverAvailable || !cliLoggedIn || !cachedSearchUri) return;

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} forward --url ${BASE_URL} "${cachedSearchUri}"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('must_obey');
      expect(result).toHaveProperty('next_action');
      expect(result).toHaveProperty('contract');
      expect(result.current_layer).toBeDefined();
    }, 30000);

    test('forward uses -u short form with URI', async () => {
      if (!serverAvailable || !cliLoggedIn || !cachedSearchUri) return;

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} forward -u ${BASE_URL} "${cachedSearchUri}"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('must_obey');
      expect(result).toHaveProperty('next_action');
      expect(result).toHaveProperty('contract');
      expect(result.current_layer).toBeDefined();
    }, 30000);
  });

  describe('train command', () => {
    test('train uses --url parameter', async () => {
      if (!serverAvailable || !cliLoggedIn) return;

      // Use --force to handle case where the adapter already exists from previous test runs
      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} train --url ${BASE_URL} --force "${TEST_FILE}"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('status');
    }, 30000);

    test('train uses -u short form', async () => {
      if (!serverAvailable || !cliLoggedIn) return;

      // Use --force to handle case where the adapter already exists from previous test runs
      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} train -u ${BASE_URL} --force "${TEST_FILE}"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('status');
    }, 30000);

    test('train with --url and --force (updates existing)', async () => {
      if (!serverAvailable || !cliLoggedIn) return;

      // Test that --force works on an existing adapter
      // The adapter should already exist from previous tests, so this covers the update path
      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} train --url ${BASE_URL} --force "${TEST_FILE}"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('status');
      // Should succeed even if the adapter already exists (force update)
      expect(result.status).toBe('stored');
    }, 30000);

    test('train with --url and --model', async () => {
      if (!serverAvailable || !cliLoggedIn) return;

      // Use --force to handle case where the adapter already exists from previous test runs
      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} train --url ${BASE_URL} --force --model "test-model" "${TEST_FILE}"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('status');
    }, 30000);
  });

  describe('token command', () => {
    test('token prints bearer token to stdout when logged in', async () => {
      if (!serverAvailable || !cliLoggedIn) return;

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} token --url ${BASE_URL}`
      );

      expect(stderr).toBe('');
      const token = stdout.trim();
      expect(token.length).toBeGreaterThan(0);
      expect(token).toMatch(/^eyJ/);
    }, 30000);

    test('token without auth fails with message', async () => {
      await expect(
        execAsyncNoAuth(`node ${CLI_PATH} token --url ${BASE_URL}`)
      ).rejects.toThrow();
    }, 10000);
  });
});

