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
    test('begin uses KAIROS_API_URL environment variable', async () => {
      if (!serverAvailable) return;

      const { stdout, stderr } = await execAsync(
        `KAIROS_API_URL=${BASE_URL} node ${CLI_PATH} begin "test query"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('protocol_status');
    }, 30000);

    test('mint uses KAIROS_API_URL environment variable', async () => {
      if (!serverAvailable) return;

      const { stdout, stderr } = await execAsync(
        `KAIROS_API_URL=${BASE_URL} node ${CLI_PATH} mint "${TEST_FILE}"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('status');
    }, 30000);

    test('--url parameter overrides KAIROS_API_URL environment variable', async () => {
      if (!serverAvailable) return;

      // Set env var to wrong URL, but --url should override
      const { stdout, stderr } = await execAsync(
        `KAIROS_API_URL=http://wrong-url:9999 node ${CLI_PATH} begin --url ${BASE_URL} "test query"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('protocol_status');
    }, 30000);
  });

  describe('Error handling with --url', () => {
    test('begin fails with invalid --url', async () => {
      if (!serverAvailable) return;

      await expect(
        execAsync(`node ${CLI_PATH} begin --url http://invalid-url:9999 "test query"`)
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

