import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { parseMcpJson, withRawOnFail } from '../utils/expect-with-raw.js';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Kairos search accessibility', () => {
  let mcpConnection;
  const QUERY = 'AI CODING RULES';

  async function purgeExistingProtocols() {
    const maxRounds = 5;
    for (let round = 0; round < maxRounds; round++) {
      const searchCall = {
        name: 'kairos_search',
        arguments: { query: QUERY }
      };
      const searchResult = await mcpConnection.client.callTool(searchCall);
      const searchPayload = parseMcpJson(searchResult, '[kairos_search] cleanup AI CODING RULES');
      if (searchPayload.protocol_status === 'no_protocol') {
        break;
      }

      const uris = new Set<string>();
      if (typeof searchPayload.start_here === 'string') {
        uris.add(searchPayload.start_here);
      }
      if (Array.isArray(searchPayload.choices)) {
        for (const choice of searchPayload.choices) {
          if (choice?.uri) {
            uris.add(choice.uri);
          }
        }
      }
      if (searchPayload.best_match?.uri) {
        uris.add(searchPayload.best_match.uri);
      }

      if (uris.size === 0) {
        break;
      }

      const deleteCall = {
        name: 'kairos_delete',
        arguments: { uris: Array.from(uris) }
      };
      const deleteResult = await mcpConnection.client.callTool(deleteCall);
      const deletePayload = parseMcpJson(deleteResult, '[kairos_delete] cleanup result');
      expect(deletePayload.total_deleted).toBeGreaterThan(0);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  beforeAll(async () => {
    mcpConnection = await createMcpConnection();
  }, 30000);

  afterAll(async () => {
    if (mcpConnection) {
      await mcpConnection.close();
    }
  });

  test('kairos_search finds AI CODING RULES after mint', async () => {
    await purgeExistingProtocols();
    await new Promise(resolve => setTimeout(resolve, 2000));

    const docPath = join(process.cwd(), 'tests', 'test-data', 'AI_CODING_RULES.md');
    const markdownDoc = readFileSync(docPath, 'utf-8');

    const mintCall = {
      name: 'kairos_mint',
      arguments: {
        markdown_doc: markdownDoc,
        llm_model_id: 'test-ai-coding-rules',
        force_update: true
      }
    };
    const mintResult = await mcpConnection.client.callTool(mintCall);
    const mintPayload = parseMcpJson(mintResult, '[kairos_mint] AI CODING RULES');

    withRawOnFail({ call: mintCall, result: mintResult }, () => {
      expect(mintPayload.status).toBe('stored');
      expect(Array.isArray(mintPayload.items)).toBe(true);
      expect(mintPayload.items.length).toBeGreaterThanOrEqual(1);
    }, '[kairos_mint] AI CODING RULES raw');

    const mintedUriSet = new Set((mintPayload.items || []).map(item => (item.uri || '').toLowerCase()));

    await new Promise(resolve => setTimeout(resolve, 3000));

    const searchCall = {
      name: 'kairos_search',
      arguments: { query: QUERY }
    };

    let searchPayload;
    let searchResult;
    const maxAttempts = 20;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      searchResult = await mcpConnection.client.callTool(searchCall);
      searchPayload = parseMcpJson(searchResult, '[kairos_search] AI CODING RULES');
      if (searchPayload.protocol_status !== 'no_protocol') {
        break;
      }
      if (attempt === maxAttempts) {
        break;
      }
      const delay = Math.min(2000 + (attempt * 500), 5000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    withRawOnFail({ call: searchCall, result: searchResult }, () => {
      expect(searchPayload).toBeDefined();
      expect(searchPayload).toHaveProperty('protocol_status');

      if (searchPayload.protocol_status === 'initiated' && searchPayload.must_obey === true) {
        expect(searchPayload.start_here).toMatch(/^kairos:\/\/mem\//);
        expect(mintedUriSet.has((searchPayload.start_here || '').toLowerCase())).toBe(true);
      } else if (
        searchPayload.protocol_status === 'initiated' &&
        searchPayload.must_obey === false &&
        typeof searchPayload.multiple_perfect_matches === 'number' &&
        searchPayload.multiple_perfect_matches > 1
      ) {
        expect(Array.isArray(searchPayload.choices)).toBe(true);
        const choiceUris = (searchPayload.choices || []).map(choice => (choice.uri || '').toLowerCase());
        expect(choiceUris.some(uri => mintedUriSet.has(uri))).toBe(true);
      } else if (searchPayload.protocol_status === 'partial_match') {
        expect(searchPayload.best_match).toBeDefined();
        expect(mintedUriSet.has((searchPayload.best_match?.uri || '').toLowerCase())).toBe(true);
      } else if (searchPayload.protocol_status === 'no_protocol') {
        const diagnostic = {
          mintedUris: Array.from(mintedUriSet),
          mintedCount: mintedUriSet.size,
          attempts: maxAttempts,
          finalResponse: searchPayload
        };
        throw new Error(`kairos_search never detected AI CODING RULES after mint. Diagnostics: ${JSON.stringify(diagnostic, null, 2)}`);
      } else {
        throw new Error(`Unexpected kairos_search response: ${JSON.stringify(searchPayload)}`);
      }
    }, '[kairos_search] AI CODING RULES raw response');
  }, 120000);
});

