import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { parseMcpJson, withRawOnFail } from '../utils/expect-with-raw.js';

/**
 * CASE 1 — ONE PERFECT MATCH (score = 1.0)
 * → Immediate obedience
 * 
 * Tests from reports/outputs.md
 */

describe('Kairos Search - CASE 1: ONE PERFECT MATCH', () => {
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
    return parseMcpJson(result, 'kairos_search raw MCP result');
  }

  test('returns must_obey: true with start_here, chain_label, total_steps', async () => {
    const ts = Date.now();
    const uniqueTitle = `PerfectMatchCase1 ${ts}`;
    const content = `# ${uniqueTitle}\n\nThis protocol tests CASE 1 behavior: single perfect match.`;

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

    // Search with exact title (should be perfect match, score = 1.0)
    const call = {
      name: 'kairos_search',
      arguments: {
        query: uniqueTitle.toLowerCase()
      }
    };
    const result = await mcpConnection.client.callTool(call);

    withRawOnFail({ call, result }, () => {
      const parsed = expectValidJsonResult(result);

      // CASE 1: Immediate obedience
      expect(parsed.must_obey).toBe(true);
      expect(parsed.protocol_status).toBe('initiated');
      expect(parsed.start_here).toBeDefined();
      expect(typeof parsed.start_here).toBe('string');
      expect(parsed.start_here.startsWith('kairos://mem/')).toBe(true);
      expect(parsed.chain_label).toBeDefined();
      expect(typeof parsed.chain_label).toBe('string');
      expect(parsed.total_steps).toBeDefined();
      expect(typeof parsed.total_steps).toBe('number');
      expect(parsed.total_steps).toBeGreaterThanOrEqual(1);

      // FORBIDDEN: Should NOT have these in CASE 1
      expect(parsed.multiple_perfect_matches).toBeUndefined();
      expect(parsed.choices).toBeUndefined();
      expect(parsed.best_match).toBeUndefined();
      expect(parsed.message).toBeUndefined();
      expect(parsed.suggestion).toBeUndefined();
      expect(parsed.hint).toBeUndefined();
    }, 'CASE 1 test');
  }, 20000);
});

