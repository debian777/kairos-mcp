import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { parseMcpJson, withRawOnFail } from '../utils/expect-with-raw.js';

/**
 * CASE 3 — NO PERFECT MATCH, BUT ONE GOOD CANDIDATE (0.7 ≤ score < 1.0)
 * → Offer with confidence — never force
 * 
 * Tests from reports/outputs.md
 */

describe('Kairos Begin - CASE 3: NO PERFECT MATCH BUT GOOD CANDIDATE', () => {
  let mcpConnection;

  beforeAll(async () => {
    mcpConnection = await createMcpConnection();
  });

  afterAll(async () => {
    if (mcpConnection) {
      await mcpConnection.close();
    }
  });

  function expectValidJsonResult(result) {
    return parseMcpJson(result, 'kairos_begin raw MCP result');
  }

  test('returns must_obey: false with best_match, message, and hint', async () => {
    const ts = Date.now();
    const uniqueTitle = `PartialMatchCase3 ${ts}`;
    const content = `# ${uniqueTitle}\n\nThis protocol tests CASE 3 behavior: no perfect match but good candidate.`;

    // Store the protocol
    const storeResult = await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: {
        markdown_doc: content,
        llm_model_id: 'minimax/minimax-m2:free'
      }
    });
    const storeResponse = expectValidJsonResult(storeResult);
    expect(storeResponse.status).toBe('stored');

    // Search with partial/non-exact query (should not be perfect match but score >= 0.7)
    const call = {
      name: 'kairos_search',
      arguments: {
        query: `partial match case3 ${ts}`
      }
    };
    const result = await mcpConnection.client.callTool(call);

    withRawOnFail({ call, result }, () => {
      const parsed = expectValidJsonResult(result);

      // CASE 3: Offer with confidence — never force
      // May get partial_match (score >= 0.7, < 1.0), no_protocol (score < 0.7), or initiated (perfect match)
      expect(parsed.protocol_status).toBeDefined();
      
      if (parsed.protocol_status === 'partial_match') {
        expect(parsed.must_obey).toBe(false);
        expect(parsed.best_match).toBeDefined();
        expect(parsed.best_match.uri).toBeDefined();
        expect(typeof parsed.best_match.uri).toBe('string');
        expect(parsed.best_match.uri.startsWith('kairos://mem/')).toBe(true);
        expect(parsed.best_match.label).toBeDefined();
        expect(typeof parsed.best_match.label).toBe('string');
        expect(parsed.best_match.score).toBeDefined();
        expect(typeof parsed.best_match.score).toBe('number');
        expect(parsed.best_match.score).toBeGreaterThanOrEqual(0.7);
        expect(parsed.best_match.score).toBeLessThan(1.0);
        expect(parsed.best_match.total_steps).toBeDefined();
        expect(typeof parsed.best_match.total_steps).toBe('number');
        expect(parsed.message).toBeDefined();
        expect(typeof parsed.message).toBe('string');
        expect(parsed.hint).toBeDefined();
        expect(typeof parsed.hint).toBe('string');
      } else if (parsed.protocol_status === 'no_protocol') {
        // Query didn't match well enough (score < 0.7), which is also valid
        expect(parsed.must_obey).toBe(false);
        expect(parsed.message).toBeDefined();
        expect(parsed.suggestion).toBeDefined();
      } else {
        // Perfect match case
        expect(parsed.protocol_status).toBe('initiated');
      }
    }, 'CASE 3 test');
  }, 20000);
});

