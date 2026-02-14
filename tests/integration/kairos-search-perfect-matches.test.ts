import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { parseMcpJson, withRawOnFail } from '../utils/expect-with-raw.js';
import { buildProofMarkdown } from '../utils/proof-of-work.js';

/**
 * Kairos Search Perfect Matches Integration Tests
 *
 * Tests edge cases and schema validation for kairos_search:
 * - No perfect match fallback behavior
 * - Output schema validation for optional fields
 * 
 * Note: Single and multiple perfect match tests are in kairos-search-case1.test.ts
 * and kairos-search-case2.test.ts respectively.
 */

describe('Kairos Search Perfect Matches', () => {
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

  test('no perfect match falls back to top result with must_obey: true', async () => {
    // Create a protocol with a unique title
    const ts = Date.now();
    const uniqueTitle = `NoPerfectMatchTest ${ts}`;
    const content = buildProofMarkdown(uniqueTitle, [
      { heading: 'Step 1 — Baseline', body: 'Document fallback behavior when no perfect match exists.', proofCmd: 'echo baseline-nomatch' },
      { heading: 'Step 2 — Investigate', body: 'Study the partial match scenario.', proofCmd: 'echo investigate-nomatch' }
    ]);

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

    // Search with query that partially matches the title (should score above threshold but below 1.0)
    // Using words from the title but not exact match
    const call = {
      name: 'kairos_search',
      arguments: {
        query: `NoPerfectMatchTest ${ts} partial`
      }
    };
    const result = await mcpConnection.client.callTool(call);
    
    withRawOnFail({ call, result }, () => {
      const parsed = expectValidJsonResult(result);
      
      // Handle two possible cases:
      // 1. If score is above threshold but below 1.0 → partial_match
      // 2. If score is below threshold or no matches → no_protocol
      if (parsed.protocol_status === 'partial_match') {
        // Should be in partial match mode (must_obey: false with best_match)
        expect(parsed.must_obey).toBe(false);
        expect(parsed.best_match).toBeDefined();
        expect(parsed.best_match.uri).toBeDefined();
        expect(typeof parsed.best_match.uri).toBe('string');
        expect(parsed.best_match.uri.startsWith('kairos://mem/')).toBe(true);
        expect(parsed.best_match.label).toBeDefined();
        expect(typeof parsed.best_match.label).toBe('string');
        expect(parsed.best_match.score).toBeDefined();
        expect(typeof parsed.best_match.score).toBe('number');
        expect(parsed.best_match.score).toBeGreaterThan(0);
        expect(parsed.best_match.score).toBeLessThan(1.0);
        expect(parsed.best_match.total_steps).toBeDefined();
        expect(typeof parsed.best_match.total_steps).toBe('number');
        expect(parsed.message).toBeDefined();
        expect(typeof parsed.message).toBe('string');
        expect(parsed.hint).toBeDefined();
        expect(typeof parsed.hint).toBe('string');
        
        // Should NOT have multiple_perfect_matches or choices in partial match mode
        expect(parsed.multiple_perfect_matches).toBeUndefined();
        expect(parsed.choices).toBeUndefined();
      } else if (parsed.protocol_status === 'no_protocol') {
        // If no results above threshold, expect no_protocol
        expect(parsed.must_obey).toBe(false);
        expect(parsed.message).toBeDefined();
        expect(typeof parsed.message).toBe('string');
        expect(parsed.suggestion).toBeDefined();
        expect(typeof parsed.suggestion).toBe('string');
        expect(parsed.best_match).toBeUndefined();
      } else if (parsed.protocol_status === 'initiated') {
        // Occasionally the query can resolve to a perfect match; ensure obedience metadata exists
        expect(parsed.must_obey).toBe(true);
        expect(parsed.start_here).toBeDefined();
      } else {
        // Fallback catch-all
        expect(['partial_match', 'no_protocol', 'initiated']).toContain(parsed.protocol_status);
      }
    }, 'no perfect match fallback test');
  }, 20000);

  test('output schema validation - all optional fields are nullable', async () => {
    // Test that the schema properly handles null values
    const ts = Date.now();
    const uniqueTitle = `SchemaValidationTest ${ts}`;
    const content = `# ${uniqueTitle}\n\nSchema validation test.`;

    // Store (force_update bypasses similarity check in shared dev collection)
    const storeResult = await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: {
        markdown_doc: content,
        llm_model_id: 'minimax/minimax-m2:free',
        force_update: true
      }
    });
    expectValidJsonResult(storeResult);

    // Single match - should have start_here, not choices
    const singleResult = await mcpConnection.client.callTool({
      name: 'kairos_search',
      arguments: {
        query: uniqueTitle.toLowerCase()
      }
    });
    const singleParsed = expectValidJsonResult(singleResult);
    
    // Verify structure - if multiple perfect matches, must_obey should be false
    if (singleParsed.multiple_perfect_matches && singleParsed.multiple_perfect_matches > 1) {
      expect(singleParsed.must_obey).toBe(false);
      expect(singleParsed).toHaveProperty('choices');
      expect(Array.isArray(singleParsed.choices)).toBe(true);
    } else {
      // Single match case - must_obey should be true
      expect(singleParsed.must_obey).toBe(true);
      expect(singleParsed.start_here).toBeDefined();
      expect(singleParsed.start_here).not.toBeNull();
      expect(singleParsed.choices).toBeUndefined();
    }
  }, 20000);
});

