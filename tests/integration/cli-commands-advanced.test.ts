/**
 * CLI Commands Advanced Tests - next, update, delete, attest commands
 * Tests CLI commands with --url parameter for commands requiring URIs
 */

import { execAsync, BASE_URL, CLI_PATH, TEST_FILE, setupServerCheck } from './cli-commands-shared.js';

describe('CLI Commands Advanced --url Tests', () => {
  let serverAvailable = false;
  let cachedMintedUri: string | null = null;

  beforeAll(async () => {
    serverAvailable = await setupServerCheck();
    // Mint once and cache the URI for all tests to reuse
    if (serverAvailable) {
      const mintResult = await execAsync(
        `node ${CLI_PATH} mint --url ${BASE_URL} --force "${TEST_FILE}"`
      );
      const mintData = JSON.parse(mintResult.stdout);
      if (mintData.items && mintData.items.length > 0) {
        cachedMintedUri = mintData.items[0].uri;
      }
    }
  }, 60000);

  async function getMintedUri(): Promise<string | null> {
    // Return cached URI to avoid expensive mint operations
    return cachedMintedUri;
  }

  describe('next command', () => {
    test('next uses --url parameter', async () => {
      if (!serverAvailable) return;

      const uri = await getMintedUri();
      if (!uri) return;

      // CLI next requires solution for steps 2+, and --output json for JSON format
      // Note: Minted URI is typically step 1, so kairos_next will be blocked
      const solution = JSON.stringify({
        type: 'comment',
        comment: { text: 'Test solution verification' }
      });

      try {
        const { stdout, stderr } = await execAsync(
          `node ${CLI_PATH} next --url ${BASE_URL} --output json --solution '${solution}' "${uri}"`
        );
        // If it succeeds, verify V2 response structure
        expect(stderr).toBe('');
        const result = JSON.parse(stdout);
        expect(result).toHaveProperty('must_obey');
        expect(result).toHaveProperty('next_action');
      } catch (error: any) {
        // If it fails (step 1 validation), verify error message
        expect(error.message || error.stderr || '').toContain('step 1');
      }
    }, 30000);

    test('next uses -u short form', async () => {
      if (!serverAvailable) return;

      const uri = await getMintedUri();
      if (!uri) return;

      // CLI next requires solution for steps 2+, and --output json for JSON format
      // Note: Minted URI is typically step 1, so kairos_next will be blocked
      const solution = JSON.stringify({
        type: 'comment',
        comment: { text: 'Test solution verification' }
      });

      try {
        const { stdout, stderr } = await execAsync(
          `node ${CLI_PATH} next -u ${BASE_URL} --output json --solution '${solution}' "${uri}"`
        );
        // If it succeeds, verify V2 response structure
        expect(stderr).toBe('');
        const result = JSON.parse(stdout);
        expect(result).toHaveProperty('must_obey');
        expect(result).toHaveProperty('next_action');
      } catch (error: any) {
        // If it fails (step 1 validation), verify error message
        expect(error.message || error.stderr || '').toContain('step 1');
      }
    }, 30000);

    test('next with --url and --solution', async () => {
      if (!serverAvailable) return;

      const uri = await getMintedUri();
      if (!uri) return;

      const solution = JSON.stringify({
        type: 'comment',
        comment: { text: 'Test solution verification' }
      });

      try {
        const { stdout, stderr } = await execAsync(
          `node ${CLI_PATH} next --url ${BASE_URL} --output json --solution '${solution}' "${uri}"`
        );
        // If it succeeds, verify V2 response structure
        expect(stderr).toBe('');
        const result = JSON.parse(stdout);
        expect(result).toHaveProperty('must_obey');
        expect(result).toHaveProperty('next_action');
      } catch (error: any) {
        // If it fails (step 1 validation), verify error message
        expect(error.message || error.stderr || '').toContain('step 1');
      }
    }, 60000);
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
});

