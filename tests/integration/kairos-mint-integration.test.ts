import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { parseMcpJson, withRawOnFail } from '../utils/expect-with-raw.js';

/**
 * Kairos Mint integration tests (integration with other tools).
 *
 * Goals:
 * - Verify integration with kairos_begin and resource reading.
 * - When something goes wrong, surface the raw MCP result
 *   instead of wrapping it in an extra "Failed to parse..." error.
 */

describe('Kairos Mint Integration', () => {
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
    return parseMcpJson(result, 'kairos_mint raw MCP result');
  }

  test('kairos_begin returns valid chain initiation response', async () => {
    // Use one timestamp for store + query
    const ts = Date.now();
    const testQuery = `CacheCheckDoc ${ts}`;
    const content = `# ${testQuery}\n\nThis document exists to test kairos_begin response.`;
    const storeResult = await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: {
        markdown_doc: JSON.stringify(content),
        llm_model_id: 'minimax/minimax-m2:free',
        force_update: true
      }
    });
    const storeResponse = expectValidJsonResult(storeResult);
    expect(storeResponse.status).toBe('stored');

    // Search — expect valid V2 response
    const call = { name: 'kairos_search', arguments: { query: testQuery } };
    const result = await mcpConnection.client.callTool(call);
    withRawOnFail({ call, result }, () => {
      const parsed = expectValidJsonResult(result);

      // V2 unified response shape (always present)
      expect(parsed.must_obey).toBe(true);
      expect(typeof parsed.message).toBe('string');
      expect(typeof parsed.next_action).toBe('string');
      expect(parsed.next_action).toContain('kairos://mem/');
      expect(Array.isArray(parsed.choices)).toBe(true);
      expect(parsed.choices.length).toBeGreaterThanOrEqual(1);

      // Each choice has the V2 shape
      for (const choice of parsed.choices) {
        expect(choice).toHaveProperty('uri');
        expect(choice).toHaveProperty('label');
        expect(choice).toHaveProperty('role');
        expect(choice).toHaveProperty('tags');
        expect(['match', 'create']).toContain(choice.role);
      }

      // V1 fields must NOT exist
      expect(parsed.start_here).toBeUndefined();
      expect(parsed.best_match).toBeUndefined();
      expect(parsed.protocol_status).toBeUndefined();
      expect(parsed.suggestion).toBeUndefined();
      expect(parsed.hint).toBeUndefined();
    }, 'kairos_search call + raw result');
  }, 20000);

});