/**
 * CLI Commands Environment Variable and Error Handling Tests
 * Tests KAIROS_API_URL environment variable and error scenarios
 */

import { execAsync, BASE_URL, CLI_PATH, TEST_FILE, setupServerCheck } from './cli-commands-shared.js';

describe('CLI Commands Environment & Error Tests', () => {
  let serverAvailable = false;

  beforeAll(async () => {
    serverAvailable = await setupServerCheck();
  }, 60000);

  describe('KAIROS_API_URL environment variable', () => {
    test('search uses KAIROS_API_URL environment variable', async () => {
      if (!serverAvailable) return;

      const { stdout, stderr } = await execAsync(
        `KAIROS_API_URL=${BASE_URL} node ${CLI_PATH} search "test query"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      // V2 unified response shape
      expect(result).toHaveProperty('must_obey');
      expect(result).toHaveProperty('perfect_matches');
      expect(result).toHaveProperty('choices');
    }, 30000);

    test('begin uses KAIROS_API_URL environment variable with URI', async () => {
      if (!serverAvailable) return;

      // Mint test protocol then search to get a valid URI (no longer rely on built-in mem docs)
      await execAsync(
        `KAIROS_API_URL=${BASE_URL} node ${CLI_PATH} mint --force "${TEST_FILE}"`
      );
      const searchResult = await execAsync(
        `KAIROS_API_URL=${BASE_URL} node ${CLI_PATH} search "Minimal CLI Test Document"`
      );
      const searchData = JSON.parse(searchResult.stdout);
      // V2: extract URI from choices array (first match)
      const matchChoice = Array.isArray(searchData.choices)
        ? searchData.choices.find((c: any) => c.role === 'match')
        : null;
      const uri = matchChoice?.uri;
      expect(uri).toBeDefined();

      const { stdout, stderr } = await execAsync(
        `KAIROS_API_URL=${BASE_URL} node ${CLI_PATH} begin "${uri}"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      // V2: next_action replaces protocol_status
      expect(result).toHaveProperty('must_obey');
      expect(result).toHaveProperty('next_action');
      expect(result).toHaveProperty('current_step');
    }, 30000);

    test('mint uses KAIROS_API_URL environment variable', async () => {
      if (!serverAvailable) return;

      // Use --force to handle case where chain already exists from previous test runs
      const { stdout, stderr } = await execAsync(
        `KAIROS_API_URL=${BASE_URL} node ${CLI_PATH} mint --force "${TEST_FILE}"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('status');
    }, 30000);

    test('--url parameter overrides KAIROS_API_URL environment variable', async () => {
      if (!serverAvailable) return;

      // Set env var to wrong URL, but --url should override
      const { stdout, stderr } = await execAsync(
        `KAIROS_API_URL=http://wrong-url:9999 node ${CLI_PATH} search --url ${BASE_URL} "test query"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      // V2 unified response shape
      expect(result).toHaveProperty('must_obey');
      expect(result).toHaveProperty('perfect_matches');
      expect(result).toHaveProperty('choices');
    }, 30000);
  });

  describe('Error handling with --url', () => {
    test('search fails with invalid --url', async () => {
      if (!serverAvailable) return;

      await expect(
        execAsync(`node ${CLI_PATH} search --url http://invalid-url:9999 "test query"`)
      ).rejects.toThrow();
    }, 30000);

    test('begin fails with invalid --url', async () => {
      if (!serverAvailable) return;

      // URI can be any; we are asserting the client rejects when server URL is invalid
      await expect(
        execAsync(`node ${CLI_PATH} begin --url http://invalid-url:9999 "kairos://mem/00000000-0000-0000-0000-000000000000"`)
      ).rejects.toThrow();
    }, 30000);

    test('mint fails with invalid --url', async () => {
      if (!serverAvailable) return;

      await expect(
        execAsync(`node ${CLI_PATH} mint --url http://invalid-url:9999 "${TEST_FILE}"`)
      ).rejects.toThrow();
    }, 30000);

    test('next fails with invalid --url', async () => {
      if (!serverAvailable) return;

      const testUri = 'kairos://mem/00000000-0000-0000-0000-000000000000';
      await expect(
        execAsync(`node ${CLI_PATH} next --url http://invalid-url:9999 "${testUri}"`)
      ).rejects.toThrow();
    }, 30000);
  });
});

