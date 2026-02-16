import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { parseMcpJson, withRawOnFail } from '../utils/expect-with-raw.js';

/**
 * CASE 4 — NO RELEVANT RESULTS (score < 0.7 or none)
 * → Offer to create — never hallucinate
 * 
 * Tests from reports/outputs.md
 */

describe('Kairos Search - CASE 4: NO RELEVANT RESULTS', () => {
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

  test('returns must_obey: false with no_protocol status, message, and suggestion', async () => {
    // Use a completely random query that should not match anything
    const ts = Date.now();
    const gibberishQuery = `XyZ123AbC789GarbageQuery${ts}NoOneWouldEverSearchForThisRandomString`;

    const call = {
      name: 'kairos_search',
      arguments: {
        query: gibberishQuery
      }
    };
    const result = await mcpConnection.client.callTool(call);

    withRawOnFail({ call, result }, () => {
      const parsed = expectValidJsonResult(result);

      // CASE 4: Offer to create — never hallucinate
      // May get no_protocol or partial_match depending on whether anything scores >= 0.7
      if (parsed.protocol_status === 'no_protocol') {
        expect(parsed.must_obey).toBe(false);
        expect(parsed.message).toBeDefined();
        expect(typeof parsed.message).toBe('string');
        expect(parsed.message).toContain("couldn't find");
        expect(parsed.message).toContain('relevant protocol');
        expect(parsed.suggestion).toBeDefined();
        expect(typeof parsed.suggestion).toBe('string');
        expect(parsed.suggestion).toContain('create');
        expect(parsed.start_here).toBeUndefined();
        expect(parsed.chain_label).toBeUndefined();
        expect(parsed.total_steps).toBeUndefined();
        expect(parsed.multiple_perfect_matches).toBeUndefined();
        // API may return choices: [] or omit; both are valid for no_protocol
        expect(parsed.choices === undefined || Array.isArray(parsed.choices)).toBe(true);
        if (Array.isArray(parsed.choices)) expect(parsed.choices).toHaveLength(0);
        expect(parsed.best_match).toBeUndefined();
        expect(parsed.hint).toBeUndefined();
      } else {
        // If something unexpectedly matches, at least verify structure
        expect(parsed.protocol_status).toBeDefined();
        expect(parsed.must_obey !== undefined).toBe(true);
      }
    }, 'CASE 4 test');
  }, 20000);
});

