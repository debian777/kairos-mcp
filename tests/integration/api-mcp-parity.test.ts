/**
 * API-MCP parity tests: same operation via MCP and HTTP must return identical response shapes.
 * No stripping of metadata; if HTTP adds fields (e.g. metadata) that MCP does not have, tests fail.
 * Schema conformance: MCP and HTTP responses must parse against the canonical Zod output schemas.
 */

import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { getAuthHeaders, getTestAuthBaseUrl } from '../utils/auth-headers.js';
import { parseMcpJson } from '../utils/expect-with-raw.js';
import { spacesOutputSchema } from '../../src/tools/kairos_spaces_schema.js';
import { searchOutputSchema } from '../../src/tools/kairos_search_schema.js';
import { dumpOutputSchema } from '../../src/tools/kairos_dump_schema.js';
import { deleteOutputSchema } from '../../src/tools/kairos_delete_schema.js';

const BASE_URL = getTestAuthBaseUrl().replace(/\/$/, '');
const API_BASE = `${BASE_URL}/api`;

function httpFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(path, {
    ...init,
    headers: { ...getAuthHeaders(), ...(init.headers as Record<string, string>) }
  });
}

function sortedKeys(obj: Record<string, unknown>): string[] {
  return Object.keys(obj).sort();
}

describe('API-MCP parity: identical response shapes', () => {
  let mcpConnection: { client: { callTool: (arg: { name: string; arguments: Record<string, unknown> }) => Promise<unknown> }; close: () => Promise<void> };

  beforeAll(async () => {
    mcpConnection = await createMcpConnection();
  }, 60000);

  afterAll(async () => {
    if (mcpConnection) await mcpConnection.close();
  });

  describe('kairos_spaces', () => {
    test('MCP and HTTP responses have identical key sets', async () => {
      expect.hasAssertions();

      const mcpResult = await mcpConnection.client.callTool({
        name: 'kairos_spaces',
        arguments: { include_chain_titles: false }
      });
      const mcpParsed = parseMcpJson(mcpResult, 'kairos_spaces MCP');

      const httpRes = await httpFetch(`${API_BASE}/kairos_spaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ include_chain_titles: false })
      });
      expect(httpRes.ok).toBe(true);
      const httpParsed = (await httpRes.json()) as Record<string, unknown>;

      expect(sortedKeys(mcpParsed)).toEqual(sortedKeys(httpParsed));
    });
  });

  describe('kairos_search', () => {
    test('MCP and HTTP responses have identical key sets', async () => {
      expect.hasAssertions();

      const query = `ParityTest ${Date.now()}`;
      const mcpResult = await mcpConnection.client.callTool({
        name: 'kairos_search',
        arguments: { query }
      });
      const mcpParsed = parseMcpJson(mcpResult, 'kairos_search MCP');

      const httpRes = await httpFetch(`${API_BASE}/kairos_search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      expect(httpRes.ok).toBe(true);
      const httpParsed = (await httpRes.json()) as Record<string, unknown>;

      expect(sortedKeys(mcpParsed)).toEqual(sortedKeys(httpParsed));
    });
  });

  describe('kairos_dump', () => {
    test('MCP and HTTP responses have identical key sets for same URI', async () => {
      expect.hasAssertions();

      const uri = 'kairos://mem/00000000-0000-0000-0000-000000002001';
      const mcpResult = await mcpConnection.client.callTool({
        name: 'kairos_dump',
        arguments: { uri, protocol: false }
      });
      const mcpParsed = parseMcpJson(mcpResult, 'kairos_dump MCP');

      const httpRes = await httpFetch(`${API_BASE}/kairos_dump`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uri, protocol: false })
      });
      expect(httpRes.ok).toBe(true);
      const httpParsed = (await httpRes.json()) as Record<string, unknown>;

      expect(sortedKeys(mcpParsed)).toEqual(sortedKeys(httpParsed));
    });
  });

  describe('kairos_delete', () => {
    test('MCP and HTTP responses have identical key sets', async () => {
      expect.hasAssertions();

      const uris = ['kairos://mem/00000000-0000-0000-0000-000000000000'];
      const mcpResult = await mcpConnection.client.callTool({
        name: 'kairos_delete',
        arguments: { uris }
      });
      const mcpParsed = parseMcpJson(mcpResult, 'kairos_delete MCP');

      const httpRes = await httpFetch(`${API_BASE}/kairos_delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uris })
      });
      expect(httpRes.ok).toBe(true);
      const httpParsed = (await httpRes.json()) as Record<string, unknown>;

      expect(sortedKeys(mcpParsed)).toEqual(sortedKeys(httpParsed));
    });
  });

  describe('Schema conformance: outputSchema.parse(response)', () => {
    test('kairos_spaces: MCP response parses against spacesOutputSchema', async () => {
      expect.hasAssertions();
      const mcpResult = await mcpConnection.client.callTool({
        name: 'kairos_spaces',
        arguments: { include_chain_titles: false }
      });
      const mcpParsed = parseMcpJson(mcpResult, 'kairos_spaces MCP');
      const parsed = spacesOutputSchema.safeParse(mcpParsed);
      expect(parsed.success).toBe(true);
    });

    test('kairos_spaces: HTTP response parses against spacesOutputSchema', async () => {
      expect.hasAssertions();
      const httpRes = await httpFetch(`${API_BASE}/kairos_spaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const httpParsed = (await httpRes.json()) as Record<string, unknown>;
      const parsed = spacesOutputSchema.safeParse(httpParsed);
      expect(parsed.success).toBe(true);
    });

    test('kairos_search: MCP response parses against searchOutputSchema', async () => {
      expect.hasAssertions();
      const mcpResult = await mcpConnection.client.callTool({
        name: 'kairos_search',
        arguments: { query: 'SchemaConformance' }
      });
      const mcpParsed = parseMcpJson(mcpResult, 'kairos_search MCP');
      const parsed = searchOutputSchema.safeParse(mcpParsed);
      expect(parsed.success).toBe(true);
    });

    test('kairos_dump: MCP response parses against dumpOutputSchema', async () => {
      expect.hasAssertions();
      const mcpResult = await mcpConnection.client.callTool({
        name: 'kairos_dump',
        arguments: { uri: 'kairos://mem/00000000-0000-0000-0000-000000002001', protocol: false }
      });
      const mcpParsed = parseMcpJson(mcpResult, 'kairos_dump MCP');
      const parsed = dumpOutputSchema.safeParse(mcpParsed);
      expect(parsed.success).toBe(true);
    });

    test('kairos_delete: MCP response parses against deleteOutputSchema', async () => {
      expect.hasAssertions();
      const mcpResult = await mcpConnection.client.callTool({
        name: 'kairos_delete',
        arguments: { uris: ['kairos://mem/00000000-0000-0000-0000-000000000000'] }
      });
      const mcpParsed = parseMcpJson(mcpResult, 'kairos_delete MCP');
      const parsed = deleteOutputSchema.safeParse(mcpParsed);
      expect(parsed.success).toBe(true);
    });
  });
});
