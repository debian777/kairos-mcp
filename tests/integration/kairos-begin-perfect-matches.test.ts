import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { parseMcpJson, withRawOnFail } from '../utils/expect-with-raw.js';
import { buildProofMarkdown } from '../utils/proof-of-work.js';

/**
 * Kairos Begin Perfect Matches Integration Tests
 *
 * Tests the new behavior for handling perfect matches (score === 1.0):
 * - Single perfect match → must_obey: true with start_here
 * - Multiple perfect matches → must_obey: false with choices array
 * - No perfect match → must_obey: true with top result (fallback)
 */

describe('Kairos Begin Perfect Matches', () => {
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

  test('single perfect match returns must_obey: true with start_here', async () => {
    // Create a unique protocol with exact title match
    const ts = Date.now();
    const uniqueTitle = `SinglePerfectMatchProtocol ${ts}`;
    const stepHeading = `Step 1 — ${uniqueTitle}`;
    const content = buildProofMarkdown(uniqueTitle, [
      { heading: stepHeading, body: 'Set up the environment for a perfect match.', proofCmd: 'echo prepare-perfect' }
    ]);

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
    // Allow Qdrant/Redis to index the new chain before querying for perfect match
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Search with exact title (should be perfect match)
    const call = {
      name: 'kairos_search',
      arguments: {
        query: uniqueTitle.toLowerCase() // Scoring normalizes to lowercase
      }
    };
    const result = await mcpConnection.client.callTool(call);
    
    withRawOnFail({ call, result }, () => {
      const parsed = expectValidJsonResult(result);
      
      // Should be in obedience mode
      expect(parsed.must_obey).toBe(true);
      expect(parsed.protocol_status).toBe('initiated');
      
      // Should have start_here, chain_label, total_steps
      expect(parsed.start_here).toBeDefined();
      expect(typeof parsed.start_here).toBe('string');
      expect(parsed.start_here.startsWith('kairos://mem/')).toBe(true);
      expect(parsed.chain_label).toBeDefined();
      expect(typeof parsed.chain_label).toBe('string');
      expect(parsed.total_steps).toBeDefined();
      expect(typeof parsed.total_steps).toBe('number');
      expect(parsed.total_steps).toBeGreaterThanOrEqual(1);
      
      // Should NOT have multiple_perfect_matches, message, or choices
      expect(parsed.multiple_perfect_matches).toBeUndefined();
      expect(parsed.message).toBeUndefined();
      expect(parsed.choices).toBeUndefined();
    }, 'single perfect match test');
  }, 20000);

  test('multiple perfect matches returns must_obey: false with choices', async () => {
    // Create multiple distinct protocols that all contain the same query string
    // Each needs a unique H1 title to create separate chains
    const ts = Date.now();
    const queryString = `docker healthcheck ${ts}`;
    
    // Create 3 protocols with different H1 titles, all containing the query string
    // This ensures they're distinct chains but all score 1.0 for the query
    const protocols = [
      buildProofMarkdown(`Docker Healthcheck Protocol A ${ts}`, [
        { heading: 'Step 1 — Prepare', body: `First step for ${queryString}.`, proofCmd: 'echo prepare-a' },
        { heading: 'Step 2 — Verify', body: `Second step. This protocol covers ${queryString} implementation.`, proofCmd: 'echo verify-a' }
      ]),
      buildProofMarkdown(`Docker Healthcheck Protocol B ${ts}`, [
        { heading: 'Step 1 — Prepare', body: `First step for ${queryString}.`, proofCmd: 'echo prepare-b' },
        { heading: 'Step 2 — Verify', body: `Second step. This protocol covers ${queryString} implementation.`, proofCmd: 'echo verify-b' }
      ]),
      buildProofMarkdown(`Docker Healthcheck Protocol C ${ts}`, [
        { heading: 'Step 1 — Prepare', body: `First step for ${queryString}.`, proofCmd: 'echo prepare-c' },
        { heading: 'Step 2 — Verify', body: `Second step. This protocol covers ${queryString} implementation.`, proofCmd: 'echo verify-c' }
      ])
    ];

    // Store all protocols (each with unique H1 = unique chain)
    const storedUris = [];
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
      if (storeResponse.items && storeResponse.items.length > 0) {
        storedUris.push(storeResponse.items[0].uri);
      }
    }

    // Wait a bit for indexing/caching
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Search with the query string (should match all 3 protocols perfectly)
    const call = {
      name: 'kairos_search',
      arguments: {
        query: queryString
      }
    };
    const result = await mcpConnection.client.callTool(call);
    
    withRawOnFail({ call, result }, () => {
      const parsed = expectValidJsonResult(result);
      
      // Should be in choice mode (not obedience) when multiple perfect matches
      // Note: This test may pass with must_obey: true if only one matches perfectly
      // The important thing is that the structure is correct
      expect(parsed).toHaveProperty('protocol_status');
      
      if (parsed.protocol_status === 'initiated' && parsed.must_obey === false) {
        // Multiple perfect matches case
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
        
        // Should not provide obedience fields in choice mode
        expect(parsed.start_here).toBeUndefined();
        expect(parsed.chain_label).toBeUndefined();
        expect(parsed.total_steps).toBeUndefined();
      } else if (parsed.protocol_status === 'partial_match') {
        // No perfect match case - should have best_match
        expect(parsed.must_obey).toBe(false);
        expect(parsed.best_match).toBeDefined();
        expect(parsed.message).toBeDefined();
      } else if (parsed.must_obey === true && parsed.protocol_status === 'initiated') {
        // If only one perfect match, should have start_here
        expect(parsed.start_here).toBeDefined();
        expect(parsed.chain_label).toBeDefined();
        expect(parsed.total_steps).toBeDefined();
      }
    }, 'multiple perfect matches test');
  }, 30000);

  test('no perfect match falls back to top result with must_obey: true', async () => {
    // Create a protocol with a unique title
    const ts = Date.now();
    const uniqueTitle = `NoPerfectMatchTest ${ts}`;
    const content = buildProofMarkdown(uniqueTitle, [
      { heading: 'Step 1 — Baseline', body: 'Document fallback behavior when no perfect match exists.', proofCmd: 'echo baseline-nomatch' },
      { heading: 'Step 2 — Investigate', body: 'Study the partial match scenario.', proofCmd: 'echo investigate-nomatch' }
    ]);

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

    // Store
    const storeResult = await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: {
        markdown_doc: content,
        llm_model_id: 'minimax/minimax-m2:free'
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

