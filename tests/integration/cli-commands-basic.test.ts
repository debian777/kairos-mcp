/**
 * CLI Commands Basic Tests - begin and mint commands
 * Tests CLI commands with --url parameter
 */

import {
  execAsync,
  BASE_URL,
  CLI_PATH,
  TEST_FILE,
  setupServerCheck,
  setupCliConfigWithLogin
} from './cli-commands-shared.js';

describe('CLI Commands Basic --url Tests', () => {
  let serverAvailable = false;
  let configHome: string | null = null;
  let cachedSearchUri: string | null = null;

  beforeAll(async () => {
    serverAvailable = await setupServerCheck();
    configHome = await setupCliConfigWithLogin();
    // Mint test protocol then get a URI from search (no longer rely on built-in mem docs)
    if (serverAvailable && configHome) {
      try {
        await execAsync(
          `node ${CLI_PATH} mint --url ${BASE_URL} --force "${TEST_FILE}"`,
          undefined,
          configHome
        );
        const searchResult = await execAsync(
          `node ${CLI_PATH} search --url ${BASE_URL} "Minimal CLI Test Document"`,
          undefined,
          configHome
        );
        const searchData = JSON.parse(searchResult.stdout);
        // V2: extract URI from choices array (first match)
        const matchChoice = Array.isArray(searchData.choices)
          ? searchData.choices.find((c: any) => c.role === 'match')
          : null;
        cachedSearchUri = matchChoice?.uri || null;
      } catch {
        cachedSearchUri = null;
      }
    }
  }, 60000);

  describe('search command', () => {
    test('search uses --url parameter', async () => {
      if (!serverAvailable || !configHome) return;

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} search --url ${BASE_URL} "test query"`,
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

    test('search uses -u short form', async () => {
      if (!serverAvailable || !configHome) return;

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} search -u ${BASE_URL} "test query"`,
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

  describe('begin command', () => {
    test('begin uses --url parameter with URI', async () => {
      if (!serverAvailable || !configHome || !cachedSearchUri) return;

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} begin --url ${BASE_URL} "${cachedSearchUri}"`,
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

    test('begin uses -u short form with URI', async () => {
      if (!serverAvailable || !configHome || !cachedSearchUri) return;

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} begin -u ${BASE_URL} "${cachedSearchUri}"`,
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
  });

  describe('mint command', () => {
    test('mint uses --url parameter', async () => {
      if (!serverAvailable || !configHome) return;

      // Use --force to handle case where chain already exists from previous test runs
      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} mint --url ${BASE_URL} --force "${TEST_FILE}"`,
        undefined,
        configHome
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('status');
    }, 30000);

    test('mint uses -u short form', async () => {
      if (!serverAvailable || !configHome) return;

      // Use --force to handle case where chain already exists from previous test runs
      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} mint -u ${BASE_URL} --force "${TEST_FILE}"`,
        undefined,
        configHome
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('status');
    }, 30000);

    test('mint with --url and --force (updates existing)', async () => {
      if (!serverAvailable || !configHome) return;

      // Test that --force works on existing chain
      // Chain should already exist from previous tests, so this tests update path
      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} mint --url ${BASE_URL} --force "${TEST_FILE}"`,
        undefined,
        configHome
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('status');
      // Should succeed even if chain already exists (force update)
      expect(result.status).toBe('stored');
    }, 30000);

    test('mint with --url and --model', async () => {
      if (!serverAvailable || !configHome) return;

      // Use --force to handle case where chain already exists from previous test runs
      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} mint --url ${BASE_URL} --force --model "test-model" "${TEST_FILE}"`,
        undefined,
        configHome
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('status');
    }, 30000);
  });
});

