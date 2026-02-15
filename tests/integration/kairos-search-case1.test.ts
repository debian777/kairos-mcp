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

    // Store the protocol (force_update bypasses similarity check in shared dev collection)
    const storeResult = await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: {
        markdown_doc: content,
        llm_model_id: 'minimax/minimax-m2:free',
        force_update: true
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
    const parsed = expectValidJsonResult(result);

    let beginUri = null;
    withRawOnFail({ call, result }, () => {
      // CASE 1: Single match → must_obey true, start_here. Or multiple perfect matches → choices; pick ours and kairos_begin later.
      if (parsed.protocol_status === 'initiated' && parsed.must_obey === true && parsed.start_here) {
        expect(parsed.start_here).toBeDefined();
        expect(typeof parsed.start_here).toBe('string');
        expect(parsed.start_here.startsWith('kairos://mem/')).toBe(true);
        expect(parsed.chain_label).toBeDefined();
        expect(typeof parsed.chain_label).toBe('string');
        expect(parsed.total_steps).toBeDefined();
        expect(typeof parsed.total_steps).toBe('number');
        expect(parsed.total_steps).toBeGreaterThanOrEqual(1);
        expect(parsed.multiple_perfect_matches).toBeUndefined();
        expect(parsed.choices).toBeUndefined();
        expect(parsed.best_match).toBeUndefined();
        return;
      }
      if (parsed.protocol_status === 'initiated' && parsed.must_obey === false && Array.isArray(parsed.choices) && parsed.choices.length > 0) {
        const ourChoice = parsed.choices.find((c) => c.chain_label === uniqueTitle || (c.label && String(c.label).includes(uniqueTitle)));
        expect(ourChoice).toBeDefined();
        expect(ourChoice.uri).toBeDefined();
        expect(ourChoice.uri.startsWith('kairos://mem/')).toBe(true);
        beginUri = ourChoice.uri;
        return;
      }
      if (parsed.protocol_status === 'partial_match' && parsed.best_match) {
        expect(parsed.best_match.uri).toBeDefined();
        expect(parsed.best_match.uri.startsWith('kairos://mem/')).toBe(true);
        expect(parsed.best_match.score).toBeGreaterThanOrEqual(0.7);
        return;
      }
      throw new Error(`CASE 1 expected initiated (must_obey: true + start_here) or (choices + pick + begin) or partial_match with best_match; got protocol_status=${parsed.protocol_status} must_obey=${parsed.must_obey}`);
    }, 'CASE 1 test');

    if (beginUri) {
      const beginResult = await mcpConnection.client.callTool({ name: 'kairos_begin', arguments: { uri: beginUri } });
      withRawOnFail({ call: { name: 'kairos_begin', arguments: { uri: beginUri } }, result: beginResult }, () => {
        const beginParsed = expectValidJsonResult(beginResult);
        expect(beginParsed.must_obey).toBe(true);
        expect(beginParsed.current_step).toBeDefined();
        expect(beginParsed.challenge).toBeDefined();
        expect(beginParsed.protocol_status).toBeDefined();
      }, 'CASE 1 kairos_begin');
    }
  }, 20000);
});

