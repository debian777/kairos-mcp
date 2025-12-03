/**
 * CLI Commands Integration Tests
 * Tests CLI commands with --url parameter and environment variable handling
 * 
 * These tests verify that all CLI commands properly respect the --url/-u parameter
 * which is critical for accessing dev/qa KAIROS instances.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { waitForHealthCheck } from '../utils/health-check.js';
import { join } from 'path';

const execAsync = promisify(exec);

const APP_PORT = process.env.PORT || '3300';
const BASE_URL = `http://localhost:${APP_PORT}`;
const CLI_PATH = join(process.cwd(), 'dist/cli/index.js');
const TEST_FILE = join(process.cwd(), 'tests/test-data/AI_CODING_RULES.md');

describe('CLI Commands --url Parameter Tests', () => {
  let serverAvailable = false;

  beforeAll(async () => {
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

  describe('next command', () => {
    test('next uses --url parameter', async () => {
      if (!serverAvailable) return;

      // First mint to get a valid URI
      const mintResult = await execAsync(
        `node ${CLI_PATH} mint --url ${BASE_URL} "${TEST_FILE}"`
      );
      const mintData = JSON.parse(mintResult.stdout);
      
      if (mintData.items && mintData.items.length > 0) {
        const uri = mintData.items[0].uri;
        const { stdout, stderr } = await execAsync(
          `node ${CLI_PATH} next --url ${BASE_URL} "${uri}"`
        );

        expect(stderr).toBe('');
        const result = JSON.parse(stdout);
        expect(result).toHaveProperty('protocol_status');
      }
    }, 30000);

    test('next uses -u short form', async () => {
      if (!serverAvailable) return;

      const mintResult = await execAsync(
        `node ${CLI_PATH} mint --url ${BASE_URL} "${TEST_FILE}"`
      );
      const mintData = JSON.parse(mintResult.stdout);
      
      if (mintData.items && mintData.items.length > 0) {
        const uri = mintData.items[0].uri;
        const { stdout, stderr } = await execAsync(
          `node ${CLI_PATH} next -u ${BASE_URL} "${uri}"`
        );

        expect(stderr).toBe('');
        const result = JSON.parse(stdout);
        expect(result).toHaveProperty('protocol_status');
      }
    }, 30000);

    test('next with --url and --proof-of-work', async () => {
      if (!serverAvailable) return;

      const mintResult = await execAsync(
        `node ${CLI_PATH} mint --url ${BASE_URL} "${TEST_FILE}"`
      );
      const mintData = JSON.parse(mintResult.stdout);
      
      if (mintData.items && mintData.items.length > 0) {
        const uri = mintData.items[0].uri;
        const proofOfWork = JSON.stringify({
          type: 'comment',
          comment: { text: 'Test proof of work verification' }
        });

        const { stdout, stderr } = await execAsync(
          `node ${CLI_PATH} next --url ${BASE_URL} "${uri}" --proof-of-work '${proofOfWork}'`
        );

        expect(stderr).toBe('');
        const result = JSON.parse(stdout);
        expect(result).toHaveProperty('protocol_status');
      }
    }, 30000);
  });

  describe('update command', () => {
    test('update uses --url parameter', async () => {
      if (!serverAvailable) return;

      // First mint to get a valid URI
      const mintResult = await execAsync(
        `node ${CLI_PATH} mint --url ${BASE_URL} "${TEST_FILE}"`
      );
      const mintData = JSON.parse(mintResult.stdout);
      
      if (mintData.items && mintData.items.length > 0) {
        const uri = mintData.items[0].uri;
        const { stdout, stderr } = await execAsync(
          `node ${CLI_PATH} update --url ${BASE_URL} --file "${TEST_FILE}" "${uri}"`
        );

        expect(stderr).toBe('');
        const result = JSON.parse(stdout);
        expect(result).toHaveProperty('results');
      }
    }, 30000);

    test('update uses -u short form', async () => {
      if (!serverAvailable) return;

      const mintResult = await execAsync(
        `node ${CLI_PATH} mint --url ${BASE_URL} "${TEST_FILE}"`
      );
      const mintData = JSON.parse(mintResult.stdout);
      
      if (mintData.items && mintData.items.length > 0) {
        const uri = mintData.items[0].uri;
        const { stdout, stderr } = await execAsync(
          `node ${CLI_PATH} update -u ${BASE_URL} --file "${TEST_FILE}" "${uri}"`
        );

        expect(stderr).toBe('');
        const result = JSON.parse(stdout);
        expect(result).toHaveProperty('results');
      }
    }, 30000);
  });

  describe('delete command', () => {
    test('delete uses --url parameter', async () => {
      if (!serverAvailable) return;

      // First mint to get a valid URI
      const mintResult = await execAsync(
        `node ${CLI_PATH} mint --url ${BASE_URL} "${TEST_FILE}"`
      );
      const mintData = JSON.parse(mintResult.stdout);
      
      if (mintData.items && mintData.items.length > 0) {
        const uri = mintData.items[0].uri;
        const { stdout, stderr } = await execAsync(
          `node ${CLI_PATH} delete --url ${BASE_URL} "${uri}"`
        );

        expect(stderr).toBe('');
        const result = JSON.parse(stdout);
        expect(result).toHaveProperty('results');
      }
    }, 30000);

    test('delete uses -u short form', async () => {
      if (!serverAvailable) return;

      const mintResult = await execAsync(
        `node ${CLI_PATH} mint --url ${BASE_URL} "${TEST_FILE}"`
      );
      const mintData = JSON.parse(mintResult.stdout);
      
      if (mintData.items && mintData.items.length > 0) {
        const uri = mintData.items[0].uri;
        const { stdout, stderr } = await execAsync(
          `node ${CLI_PATH} delete -u ${BASE_URL} "${uri}"`
        );

        expect(stderr).toBe('');
        const result = JSON.parse(stdout);
        expect(result).toHaveProperty('results');
      }
    }, 30000);
  });

  describe('attest command', () => {
    test('attest uses --url parameter', async () => {
      if (!serverAvailable) return;

      // First mint to get a valid URI
      const mintResult = await execAsync(
        `node ${CLI_PATH} mint --url ${BASE_URL} "${TEST_FILE}"`
      );
      const mintData = JSON.parse(mintResult.stdout);
      
      if (mintData.items && mintData.items.length > 0) {
        const uri = mintData.items[0].uri;
        const { stdout, stderr } = await execAsync(
          `node ${CLI_PATH} attest --url ${BASE_URL} "${uri}" success "Test attestation"`
        );

        expect(stderr).toBe('');
        const result = JSON.parse(stdout);
        expect(result).toHaveProperty('results');
      }
    }, 30000);

    test('attest uses -u short form', async () => {
      if (!serverAvailable) return;

      const mintResult = await execAsync(
        `node ${CLI_PATH} mint --url ${BASE_URL} "${TEST_FILE}"`
      );
      const mintData = JSON.parse(mintResult.stdout);
      
      if (mintData.items && mintData.items.length > 0) {
        const uri = mintData.items[0].uri;
        const { stdout, stderr } = await execAsync(
          `node ${CLI_PATH} attest -u ${BASE_URL} "${uri}" success "Test attestation"`
        );

        expect(stderr).toBe('');
        const result = JSON.parse(stdout);
        expect(result).toHaveProperty('results');
      }
    }, 30000);

    test('attest with --url and --quality-bonus', async () => {
      if (!serverAvailable) return;

      const mintResult = await execAsync(
        `node ${CLI_PATH} mint --url ${BASE_URL} "${TEST_FILE}"`
      );
      const mintData = JSON.parse(mintResult.stdout);
      
      if (mintData.items && mintData.items.length > 0) {
        const uri = mintData.items[0].uri;
        const { stdout, stderr } = await execAsync(
          `node ${CLI_PATH} attest --url ${BASE_URL} "${uri}" success "Test" --quality-bonus 5`
        );

        expect(stderr).toBe('');
        const result = JSON.parse(stdout);
        expect(result).toHaveProperty('results');
      }
    }, 30000);

    test('attest with --url and --model', async () => {
      if (!serverAvailable) return;

      const mintResult = await execAsync(
        `node ${CLI_PATH} mint --url ${BASE_URL} "${TEST_FILE}"`
      );
      const mintData = JSON.parse(mintResult.stdout);
      
      if (mintData.items && mintData.items.length > 0) {
        const uri = mintData.items[0].uri;
        const { stdout, stderr } = await execAsync(
          `node ${CLI_PATH} attest --url ${BASE_URL} "${uri}" success "Test" --model "test-model"`
        );

        expect(stderr).toBe('');
        const result = JSON.parse(stdout);
        expect(result).toHaveProperty('results');
      }
    }, 30000);
  });

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

