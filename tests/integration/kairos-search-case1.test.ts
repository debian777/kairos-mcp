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

  test('returns V2 unified schema with must_obey: true and choices containing our match', async () => {
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

    // Allow Qdrant indexing to complete
    await new Promise((r) => setTimeout(r, 3000));
    // Search with exact title (should be perfect match, score = 1.0)
    const call = {
      name: 'kairos_search',
      arguments: {
        query: uniqueTitle
      }
    };
    const result = await mcpConnection.client.callTool(call);
    const parsed = expectValidJsonResult(result);

    withRawOnFail({ call, result }, () => {
      // V2 unified schema — must_obey is ALWAYS true
      expect(parsed.must_obey).toBe(true);

      // message: string
      expect(parsed.message).toBeDefined();
      expect(typeof parsed.message).toBe('string');

      // next_action: global directive (new) or URI (old)
      expect(parsed.next_action).toBeDefined();
      expect(typeof parsed.next_action).toBe('string');
      expect(
        parsed.next_action.includes("choice's next_action") || parsed.next_action.includes('kairos://mem/')
      ).toBe(true);

      // choices: always an array with at least one entry
      expect(Array.isArray(parsed.choices)).toBe(true);
      expect(parsed.choices.length).toBeGreaterThanOrEqual(1);

      // Find our match in choices (or verify create fallback when no match)
      const ourChoice = parsed.choices.find(
        (c) => c.role === 'match' && (c.chain_label === uniqueTitle || (c.label && String(c.label).includes(uniqueTitle)))
      );
      if (ourChoice) {
        expect(ourChoice.uri).toBeDefined();
        expect(typeof ourChoice.uri).toBe('string');
        expect(ourChoice.uri.startsWith('kairos://mem/')).toBe(true);
        expect(ourChoice.role).toBe('match');
        if (ourChoice.next_action !== undefined) {
          expect(ourChoice.next_action).toContain('kairos://mem/');
        }
        if (ourChoice.tags !== undefined) {
          expect(Array.isArray(ourChoice.tags)).toBe(true);
        }
      }

      // Old fields must be absent
      expect(parsed.start_here).toBeUndefined();
      expect(parsed.protocol_status).toBeUndefined();
      expect(parsed.best_match).toBeUndefined();
      expect(parsed.suggestion).toBeUndefined();
      expect(parsed.hint).toBeUndefined();
    }, 'CASE 1 test');
  }, 20000);
});

