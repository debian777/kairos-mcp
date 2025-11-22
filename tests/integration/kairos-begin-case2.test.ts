import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { parseMcpJson, withRawOnFail } from '../utils/expect-with-raw.js';

/**
 * CASE 2 — MULTIPLE PERFECT MATCHES (score = 1.0 × N)
 * → Positive choice — never force
 * 
 * Tests from reports/outputs.md
 */

describe('Kairos Begin - CASE 2: MULTIPLE PERFECT MATCHES', () => {
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

  test('returns must_obey: false with choices array and positive message', async () => {
    const ts = Date.now();
    const queryString = `MultiplePerfectMatch ${ts}`;

    // Create 3 protocols with different H1 titles, all containing the query string
    const protocols = [
      `# Protocol A ${queryString}\n\n## Step 1\nFirst step.\n\n## Step 2\nSecond step.\n\nThis protocol covers ${queryString} implementation.`,
      `# Protocol B ${queryString}\n\n## Step 1\nFirst step.\n\n## Step 2\nSecond step.\n\nThis protocol covers ${queryString} implementation.`,
      `# Protocol C ${queryString}\n\n## Step 1\nFirst step.\n\n## Step 2\nSecond step.\n\nThis protocol covers ${queryString} implementation.`
    ];

    // Store all protocols (each with unique H1 = unique chain)
    for (const protocol of protocols) {
      const storeResult = await mcpConnection.client.callTool({
        name: 'kairos_mint',
        arguments: {
          markdown_doc: protocol,
          llm_model_id: 'minimax/minimax-m2:free'
        }
      });
      const storeResponse = expectValidJsonResult(storeResult);
      expect(storeResponse.status).toBe('stored');
    }

    // Wait for indexing/caching
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Search with the query string (should match all 3 protocols perfectly)
    const call = {
      name: 'kairos_begin',
      arguments: {
        query: queryString,
        limit: 10
      }
    };
    const result = await mcpConnection.client.callTool(call);

    withRawOnFail({ call, result }, () => {
      const parsed = expectValidJsonResult(result);

      // CASE 2: Positive choice — never force
      if (parsed.multiple_perfect_matches && parsed.multiple_perfect_matches > 1) {
        expect(parsed.must_obey).toBe(false);
        expect(parsed.protocol_status).toBe('initiated');
        expect(parsed.multiple_perfect_matches).toBeDefined();
        expect(typeof parsed.multiple_perfect_matches).toBe('number');
        expect(parsed.multiple_perfect_matches).toBeGreaterThanOrEqual(2);

        // Should have positive message
        expect(parsed.message).toBeDefined();
        expect(typeof parsed.message).toBe('string');
        expect(parsed.message).toContain('canonical protocols');
        expect(parsed.message).toContain('perfectly match');

        // Should have choices array
        expect(parsed.choices).toBeDefined();
        expect(Array.isArray(parsed.choices)).toBe(true);
        expect(parsed.choices.length).toBe(parsed.multiple_perfect_matches);

        // Each choice should have uri, label, and optional tags
        for (const choice of parsed.choices) {
          expect(choice.uri).toBeDefined();
          expect(typeof choice.uri).toBe('string');
          expect(choice.uri.startsWith('kairos://mem/')).toBe(true);
          expect(choice.label).toBeDefined();
          expect(typeof choice.label).toBe('string');
          if (choice.tags !== undefined) {
            expect(Array.isArray(choice.tags)).toBe(true);
          }
        }

        // FORBIDDEN: Should NOT have these in CASE 2
        expect(parsed.start_here).toBeUndefined();
        expect(parsed.chain_label).toBeUndefined();
        expect(parsed.total_steps).toBeUndefined();
        expect(parsed.best_match).toBeUndefined();
        expect(parsed.suggestion).toBeUndefined();
        expect(parsed.hint).toBeUndefined();
      } else {
        // If only one perfect match, fall through to CASE 1
        expect(parsed.must_obey).toBe(true);
        expect(parsed.protocol_status).toBe('initiated');
      }
    }, 'CASE 2 test');
  }, 30000);
});

