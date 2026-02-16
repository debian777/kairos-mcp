import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { parseMcpJson, withRawOnFail } from '../utils/expect-with-raw.js';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Kairos mint accessibility', () => {
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

      // V2: collect URIs from choices array
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

  test('kairos_mint stores AI CODING RULES markdown', async () => {
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
  }, 60000);
});

