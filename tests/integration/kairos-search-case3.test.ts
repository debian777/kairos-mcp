import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { parseMcpJson, withRawOnFail } from '../utils/expect-with-raw.js';

/**
 * CASE 3 — NO PERFECT MATCH, BUT ONE GOOD CANDIDATE (0.7 ≤ score < 1.0)
 * → Offer with confidence — never force
 * 
 * Tests from reports/outputs.md
 */

describe('Kairos Search - CASE 3: NO PERFECT MATCH BUT GOOD CANDIDATE', () => {
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

  test('returns V2 unified schema with non-perfect match candidates in choices', async () => {
    const ts = Date.now();
    const uniqueTitle = `PartialMatchCase3 ${ts}`;
    const content = `# ${uniqueTitle}\n\nThis protocol tests CASE 3 behavior: no perfect match but good candidate.`;

    // Store the protocol
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

    // Search with partial/non-exact query (should not be perfect match but may score above threshold)
    const call = {
      name: 'kairos_search',
      arguments: {
        query: `partial match case3 ${ts}`
      }
    };
    const result = await mcpConnection.client.callTool(call);

    withRawOnFail({ call, result }, () => {
      const parsed = expectValidJsonResult(result);

      // V2 unified schema — must_obey is ALWAYS true
      expect(parsed.must_obey).toBe(true);

      // perfect_matches: number (0 for partial/no match)
      expect(typeof parsed.perfect_matches).toBe('number');

      // message: always present
      expect(parsed.message).toBeDefined();
      expect(typeof parsed.message).toBe('string');

      // next_action: always present
      expect(parsed.next_action).toBeDefined();
      expect(typeof parsed.next_action).toBe('string');

      // choices: always an array with at least one entry (the create protocol)
      expect(Array.isArray(parsed.choices)).toBe(true);
      expect(parsed.choices.length).toBeGreaterThanOrEqual(1);

      // If there are match choices, validate their structure
      const matchChoices = parsed.choices.filter((c) => c.role === 'match');
      for (const choice of matchChoices) {
        expect(choice.uri).toBeDefined();
        expect(typeof choice.uri).toBe('string');
        expect(choice.uri.startsWith('kairos://mem/')).toBe(true);
        expect(choice.label).toBeDefined();
        expect(typeof choice.label).toBe('string');
        expect(choice.role).toBe('match');
        // score may be a number or null
        if (choice.score !== null && choice.score !== undefined) {
          expect(typeof choice.score).toBe('number');
        }
        if (choice.tags !== undefined) {
          expect(Array.isArray(choice.tags)).toBe(true);
        }
      }

      // There should be at least one create choice
      const createChoices = parsed.choices.filter((c) => c.role === 'create');
      expect(createChoices.length).toBeGreaterThanOrEqual(1);
      for (const cc of createChoices) {
        expect(cc.uri).toBeDefined();
        expect(cc.role).toBe('create');
      }

      // Old fields must be absent
      expect(parsed.protocol_status).toBeUndefined();
      expect(parsed.best_match).toBeUndefined();
      expect(parsed.suggestion).toBeUndefined();
      expect(parsed.hint).toBeUndefined();
      expect(parsed.start_here).toBeUndefined();
      expect(parsed.multiple_perfect_matches).toBeUndefined();
    }, 'CASE 3 test');
  }, 20000);
});

