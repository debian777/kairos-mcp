/**
 * CLI Commands Advanced Tests - next, update, delete, attest commands
 * Tests CLI commands with --url parameter for commands requiring URIs
 */

import { execAsync, BASE_URL, CLI_PATH, TEST_FILE, setupServerCheck } from './cli-commands-shared.js';

describe('CLI Commands Advanced --url Tests', () => {
  let serverAvailable = false;

  beforeAll(async () => {
    serverAvailable = await setupServerCheck();
  }, 60000);

  async function getMintedUri(): Promise<string | null> {
    // Use --force to handle case where chain already exists from previous test runs
    const mintResult = await execAsync(
      `node ${CLI_PATH} mint --url ${BASE_URL} --force "${TEST_FILE}"`
    );
    const mintData = JSON.parse(mintResult.stdout);
    
    if (mintData.items && mintData.items.length > 0) {
      return mintData.items[0].uri;
    }
    return null;
  }

  describe('next command', () => {
    test('next uses --url parameter', async () => {
      if (!serverAvailable) return;

      const uri = await getMintedUri();
      if (!uri) return;

      // CLI next requires proof_of_work for steps 2+, and --output json for JSON format
      const proofOfWork = JSON.stringify({
        type: 'comment',
        comment: { text: 'Test proof of work verification' }
      });

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} next --url ${BASE_URL} --output json --proof-of-work '${proofOfWork}' "${uri}"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('protocol_status');
    }, 30000);

    test('next uses -u short form', async () => {
      if (!serverAvailable) return;

      const uri = await getMintedUri();
      if (!uri) return;

      // CLI next requires proof_of_work for steps 2+, and --output json for JSON format
      const proofOfWork = JSON.stringify({
        type: 'comment',
        comment: { text: 'Test proof of work verification' }
      });

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} next -u ${BASE_URL} --output json --proof-of-work '${proofOfWork}' "${uri}"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('protocol_status');
    }, 30000);

    test('next with --url and --proof-of-work', async () => {
      if (!serverAvailable) return;

      const uri = await getMintedUri();
      if (!uri) return;

      const proofOfWork = JSON.stringify({
        type: 'comment',
        comment: { text: 'Test proof of work verification' }
      });

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} next --url ${BASE_URL} --output json --proof-of-work '${proofOfWork}' "${uri}"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('protocol_status');
    }, 30000);
  });

  describe('update command', () => {
    test('update uses --url parameter', async () => {
      if (!serverAvailable) return;

      const uri = await getMintedUri();
      if (!uri) return;

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} update --url ${BASE_URL} --file "${TEST_FILE}" "${uri}"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('results');
    }, 30000);

    test('update uses -u short form', async () => {
      if (!serverAvailable) return;

      const uri = await getMintedUri();
      if (!uri) return;

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} update -u ${BASE_URL} --file "${TEST_FILE}" "${uri}"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('results');
    }, 30000);
  });

  describe('delete command', () => {
    test('delete uses --url parameter', async () => {
      if (!serverAvailable) return;

      const uri = await getMintedUri();
      if (!uri) return;

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} delete --url ${BASE_URL} "${uri}"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('results');
    }, 30000);

    test('delete uses -u short form', async () => {
      if (!serverAvailable) return;

      const uri = await getMintedUri();
      if (!uri) return;

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} delete -u ${BASE_URL} "${uri}"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('results');
    }, 30000);
  });

  describe('attest command', () => {
    test('attest uses --url parameter', async () => {
      if (!serverAvailable) return;

      const uri = await getMintedUri();
      if (!uri) return;

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} attest --url ${BASE_URL} "${uri}" success "Test attestation"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('results');
    }, 30000);

    test('attest uses -u short form', async () => {
      if (!serverAvailable) return;

      const uri = await getMintedUri();
      if (!uri) return;

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} attest -u ${BASE_URL} "${uri}" success "Test attestation"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('results');
    }, 30000);

    test('attest with --url and --quality-bonus', async () => {
      if (!serverAvailable) return;

      const uri = await getMintedUri();
      if (!uri) return;

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} attest --url ${BASE_URL} "${uri}" success "Test" --quality-bonus 5`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('results');
    }, 30000);

    test('attest with --url and --model', async () => {
      if (!serverAvailable) return;

      const uri = await getMintedUri();
      if (!uri) return;

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} attest --url ${BASE_URL} "${uri}" success "Test" --model "test-model"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('results');
    }, 30000);
  });
});

