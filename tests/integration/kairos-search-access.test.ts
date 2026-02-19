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

      // V2: collect URIs from choices array (only match roles)
      const uris = new Set<string>();
      if (Array.isArray(searchPayload.choices)) {
        for (const choice of searchPayload.choices) {
          if (choice?.uri && choice.role === 'match') {
            uris.add(choice.uri);
          }
        }
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
      // V2: check if we have match choices
      const hasMatches = Array.isArray(searchPayload.choices) &&
        searchPayload.choices.some((c: any) => c.role === 'match');
      if (hasMatches) {
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

      // V2 unified response shape
      expect(searchPayload.must_obey).toBe(true);
      expect(typeof searchPayload.message).toBe('string');
      expect(typeof searchPayload.next_action).toBe('string');
      expect(
        searchPayload.next_action.includes("choice's next_action") || searchPayload.next_action.includes('kairos://mem/')
      ).toBe(true);
      expect(Array.isArray(searchPayload.choices)).toBe(true);
      expect(searchPayload.choices.length).toBeGreaterThanOrEqual(1);

      // Check that at least one minted URI appears in the choices
      const choiceUris = (searchPayload.choices || []).map((choice: any) => (choice.uri || '').toLowerCase());
      const foundMintedUri = choiceUris.some((uri: string) => mintedUriSet.has(uri));

      if (!foundMintedUri) {
        const diagnostic = {
          mintedUris: Array.from(mintedUriSet),
          mintedCount: mintedUriSet.size,
          attempts: maxAttempts,
          choiceUris,
          finalResponse: searchPayload
        };
        throw new Error(`kairos_search never detected AI CODING RULES after mint. Diagnostics: ${JSON.stringify(diagnostic, null, 2)}`);
      }

      expect(foundMintedUri).toBe(true);

      // V1 fields must NOT exist
      expect(searchPayload.protocol_status).toBeUndefined();
      expect(searchPayload.start_here).toBeUndefined();
      expect(searchPayload.best_match).toBeUndefined();
    }, '[kairos_search] AI CODING RULES raw response');
  }, 120000);
});

