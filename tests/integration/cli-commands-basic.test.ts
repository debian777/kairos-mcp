/**
 * CLI Commands Basic Tests - begin and mint commands
 * Tests CLI commands with --url parameter
 */

import { execAsync, BASE_URL, CLI_PATH, TEST_FILE, setupServerCheck } from './cli-commands-shared.js';

describe('CLI Commands Basic --url Tests', () => {
  let serverAvailable = false;

  beforeAll(async () => {
    serverAvailable = await setupServerCheck();
  }, 60000);

  describe('begin command', () => {
    test('begin uses --url parameter', async () => {
      if (!serverAvailable) return;

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} begin --url ${BASE_URL} "test query"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('protocol_status');
    }, 30000);

    test('begin uses -u short form', async () => {
      if (!serverAvailable) return;

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} begin -u ${BASE_URL} "test query"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('protocol_status');
    }, 30000);
  });

  describe('mint command', () => {
    test('mint uses --url parameter', async () => {
      if (!serverAvailable) return;

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} mint --url ${BASE_URL} "${TEST_FILE}"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('status');
    }, 30000);

    test('mint uses -u short form', async () => {
      if (!serverAvailable) return;

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} mint -u ${BASE_URL} "${TEST_FILE}"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('status');
    }, 30000);

    test('mint with --url and --force', async () => {
      if (!serverAvailable) return;

      // First mint
      await execAsync(`node ${CLI_PATH} mint --url ${BASE_URL} "${TEST_FILE}"`);
      
      // Second mint with --force
      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} mint --url ${BASE_URL} --force "${TEST_FILE}"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('status');
    }, 30000);

    test('mint with --url and --model', async () => {
      if (!serverAvailable) return;

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} mint --url ${BASE_URL} --model "test-model" "${TEST_FILE}"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('status');
    }, 30000);
  });
});

