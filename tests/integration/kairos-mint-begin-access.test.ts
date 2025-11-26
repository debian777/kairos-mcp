import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { parseMcpJson, withRawOnFail } from '../utils/expect-with-raw.js';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Kairos mint + begin accessibility', () => {
  let mcpConnection;
  const QUERY = 'AI CODING RULES';

  async function purgeExistingProtocols() {
    const maxRounds = 5;
    for (let round = 0; round < maxRounds; round++) {
      const beginCall = {
        name: 'kairos_begin',
        arguments: {
          query: QUERY
        }
      };
      const beginResult = await mcpConnection.client.callTool(beginCall);
      const beginPayload = parseMcpJson(beginResult, '[kairos_begin] cleanup AI CODING RULES');
      if (beginPayload.protocol_status === 'no_protocol') {
        break;
      }

      const uris = new Set<string>();
      if (typeof beginPayload.start_here === 'string') {
        uris.add(beginPayload.start_here);
      }
      if (Array.isArray(beginPayload.choices)) {
        for (const choice of beginPayload.choices) {
          if (choice?.uri) {
            uris.add(choice.uri);
          }
        }
      }
      if (beginPayload.best_match?.uri) {
        uris.add(beginPayload.best_match.uri);
      }

      if (uris.size === 0) {
        break;
      }

      const deleteCall = {
        name: 'kairos_delete',
        arguments: {
          uris: Array.from(uris)
        }
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

  test('AI CODING RULES markdown is retrievable via kairos_begin after mint', async () => {
    // Ensure previous AI CODING RULES chains are cleared to avoid false positives from older data
    await purgeExistingProtocols();

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

    // Wait for Qdrant to index the newly minted vectors
    // Qdrant may need time to make vectors searchable after upsert
    // Longer wait for slower environments (QA, CI)
    await new Promise(resolve => setTimeout(resolve, 3000));

    const beginCall = {
      name: 'kairos_begin',
      arguments: {
        query: QUERY
      }
    };

    let beginPayload;
    let beginResult;
    const maxAttempts = 20;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      beginResult = await mcpConnection.client.callTool(beginCall);
      beginPayload = parseMcpJson(beginResult, '[kairos_begin] AI CODING RULES');
      if (beginPayload.protocol_status !== 'no_protocol') {
        break;
      }
      if (attempt === maxAttempts) {
        break;
      }
      // Exponential backoff: 2s, 3s, 4s, etc. up to 5s max per retry
      const delay = Math.min(2000 + (attempt * 500), 5000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    withRawOnFail({ call: beginCall, result: beginResult }, () => {
      expect(beginPayload).toBeDefined();
      expect(beginPayload).toHaveProperty('protocol_status');

      if (beginPayload.protocol_status === 'initiated' && beginPayload.must_obey === true) {
        expect(beginPayload.start_here).toMatch(/^kairos:\/\/mem\//);
        expect(mintedUriSet.has((beginPayload.start_here || '').toLowerCase())).toBe(true);
      } else if (
        beginPayload.protocol_status === 'initiated' &&
        beginPayload.must_obey === false &&
        typeof beginPayload.multiple_perfect_matches === 'number' &&
        beginPayload.multiple_perfect_matches > 1
      ) {
        expect(Array.isArray(beginPayload.choices)).toBe(true);
        const choiceUris = (beginPayload.choices || []).map(choice => (choice.uri || '').toLowerCase());
        expect(choiceUris.some(uri => mintedUriSet.has(uri))).toBe(true);
      } else if (beginPayload.protocol_status === 'partial_match') {
        expect(beginPayload.best_match).toBeDefined();
        expect(mintedUriSet.has((beginPayload.best_match?.uri || '').toLowerCase())).toBe(true);
      } else if (beginPayload.protocol_status === 'no_protocol') {
        throw new Error('kairos_begin never detected AI CODING RULES after mint');
      } else {
        throw new Error(`Unexpected kairos_begin response: ${JSON.stringify(beginPayload)}`);
      }
    }, '[kairos_begin] AI CODING RULES raw response');
  }, 120000);
});

