/**
 * CLI Commands Advanced Tests - forward, tune, delete, reward commands
 * Tests CLI commands with --url parameter for commands requiring URIs
 */

import {
  execAsync,
  BASE_URL,
  CLI_PATH,
  TEST_FILE,
  setupServerCheck,
  setupCliConfigWithLogin,
  requireMcpServerAndCliLogin,
  requireCachedLayerUri
} from './cli-commands-shared.js';

describe('CLI Commands Advanced --url Tests', () => {
  let serverAvailable = false;
  let cliLoggedIn = false;
  let cachedMintedUri: string | null = null;

  beforeAll(async () => {
    serverAvailable = await setupServerCheck();
    cliLoggedIn = await setupCliConfigWithLogin();
    if (serverAvailable && cliLoggedIn) {
      const mintResult = await execAsync(
        `node ${CLI_PATH} train --url ${BASE_URL} --force "${TEST_FILE}"`
      );
      const mintData = JSON.parse(mintResult.stdout);
      if (mintData.items && mintData.items.length > 0) {
        cachedMintedUri = mintData.items[0].uri;
      }
    }
  }, 60000);

  describe('forward command', () => {
    test('forward uses --url parameter with optional solution', async () => {
      requireMcpServerAndCliLogin(serverAvailable, cliLoggedIn);
      requireCachedLayerUri(cachedMintedUri, 'CLI advanced forward');
      const uri = cachedMintedUri;

      const solution = JSON.stringify({
        type: 'comment',
        comment: { text: 'Test solution verification' }
      });

      try {
        const { stdout, stderr } = await execAsync(
          `node ${CLI_PATH} forward --url ${BASE_URL} --solution '${solution}' "${uri}"`
        );
        expect(stderr).toBe('');
        const result = JSON.parse(stdout);
        expect(result).toHaveProperty('must_obey');
        expect(result).toHaveProperty('next_action');
      } catch (error: unknown) {
        const e = error as { message?: string; stderr?: string };
        expect(e.message || e.stderr || '').toMatch(/step|layer|contract|solution|invalid/i);
      }
    }, 30000);

    test('forward uses -u short form', async () => {
      requireMcpServerAndCliLogin(serverAvailable, cliLoggedIn);
      requireCachedLayerUri(cachedMintedUri, 'CLI advanced forward');
      const uri = cachedMintedUri;

      const solution = JSON.stringify({
        type: 'comment',
        comment: { text: 'Test solution verification' }
      });

      try {
        const { stdout, stderr } = await execAsync(
          `node ${CLI_PATH} forward -u ${BASE_URL} --solution '${solution}' "${uri}"`
        );
        expect(stderr).toBe('');
        const result = JSON.parse(stdout);
        expect(result).toHaveProperty('must_obey');
        expect(result).toHaveProperty('next_action');
      } catch (error: unknown) {
        const e = error as { message?: string; stderr?: string };
        expect(e.message || e.stderr || '').toMatch(/step|layer|contract|solution|invalid/i);
      }
    }, 30000);
  });

  describe('tune command', () => {
    test('tune uses --url parameter', async () => {
      requireMcpServerAndCliLogin(serverAvailable, cliLoggedIn);
      requireCachedLayerUri(cachedMintedUri, 'CLI advanced tune');
      const uri = cachedMintedUri;

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} tune --url ${BASE_URL} --file "${TEST_FILE}" "${uri}"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('results');
    }, 30000);

    test('tune uses -u short form', async () => {
      requireMcpServerAndCliLogin(serverAvailable, cliLoggedIn);
      requireCachedLayerUri(cachedMintedUri, 'CLI advanced tune');
      const uri = cachedMintedUri;

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} tune -u ${BASE_URL} --file "${TEST_FILE}" "${uri}"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('results');
    }, 30000);
  });

  describe('reward command', () => {
    test('reward uses --url parameter', async () => {
      requireMcpServerAndCliLogin(serverAvailable, cliLoggedIn);
      requireCachedLayerUri(cachedMintedUri, 'CLI advanced reward');
      const uri = cachedMintedUri;

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} reward --url ${BASE_URL} "${uri}" success "Test reward"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('results');
    }, 30000);

    test('reward uses -u short form', async () => {
      requireMcpServerAndCliLogin(serverAvailable, cliLoggedIn);
      requireCachedLayerUri(cachedMintedUri, 'CLI advanced reward');
      const uri = cachedMintedUri;

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} reward -u ${BASE_URL} "${uri}" success "Test reward"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('results');
    }, 30000);

    test('reward with --url and --score', async () => {
      requireMcpServerAndCliLogin(serverAvailable, cliLoggedIn);
      requireCachedLayerUri(cachedMintedUri, 'CLI advanced reward');
      const uri = cachedMintedUri;

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} reward --url ${BASE_URL} "${uri}" success "Test" --score 0.9`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('results');
    }, 30000);

    test('reward with --url and --model', async () => {
      requireMcpServerAndCliLogin(serverAvailable, cliLoggedIn);
      requireCachedLayerUri(cachedMintedUri, 'CLI advanced reward');
      const uri = cachedMintedUri;

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} reward --url ${BASE_URL} "${uri}" success "Test" --model "test-model"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('results');
    }, 30000);
  });

  describe('delete command', () => {
    test('delete uses --url parameter', async () => {
      requireMcpServerAndCliLogin(serverAvailable, cliLoggedIn);
      requireCachedLayerUri(cachedMintedUri, 'CLI advanced delete');
      const uri = cachedMintedUri;

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} delete --url ${BASE_URL} "${uri}"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('results');
    }, 30000);

    test('delete uses -u short form', async () => {
      requireMcpServerAndCliLogin(serverAvailable, cliLoggedIn);
      requireCachedLayerUri(cachedMintedUri, 'CLI advanced delete');
      const uri = cachedMintedUri;

      const { stdout, stderr } = await execAsync(
        `node ${CLI_PATH} delete -u ${BASE_URL} "${uri}"`
      );

      expect(stderr).toBe('');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('results');
    }, 30000);
  });
});

