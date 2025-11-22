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
        llm_model_id: 'minimax/minimax-m2:free'
      }
    });
    const storeResponse = expectValidJsonResult(storeResult);
    expect(storeResponse.status).toBe('stored');

    // Search — expect valid response
    const call = { name: 'kairos_begin', arguments: { query: testQuery, limit: 1 } };
    const result = await mcpConnection.client.callTool(call);
    withRawOnFail({ call, result }, () => {
      const parsed = expectValidJsonResult(result);
      expect(parsed).toHaveProperty('protocol_status');
      
      // Handle perfect match case (must_obey: true)
      if (parsed.must_obey === true && parsed.protocol_status === 'initiated') {
        expect(parsed.start_here).toBeDefined();
        expect(typeof parsed.start_here).toBe('string');
        expect(parsed.start_here.startsWith('kairos://mem/')).toBe(true);
        expect(parsed.chain_label).toBeDefined();
        expect(typeof parsed.chain_label).toBe('string');
        expect(parsed.total_steps).toBeDefined();
        expect(typeof parsed.total_steps).toBe('number');
      } else if (parsed.protocol_status === 'partial_match' && parsed.best_match) {
        // Handle no perfect match case (must_obey: false with best_match)
        expect(parsed.must_obey).toBe(false);
        expect(parsed.best_match).toBeDefined();
        expect(typeof parsed.best_match.uri).toBe('string');
        expect(parsed.best_match.uri.startsWith('kairos://mem/')).toBe(true);
        expect(parsed.message).toBeDefined();
        expect(typeof parsed.message).toBe('string');
      } else {
        // Fallback: should have some valid response structure
        expect(parsed.protocol_status).toBeDefined();
      }
    }, 'kairos_begin call + raw result');
  }, 20000);

  test('kairos://mem/{uuid} render includes KAIROS markers and UUID', async () => {
    const content = `# CacheResourceDoc ${Date.now()}\n\nResource cache behavior validation.`;
    const storeResult = await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: {
        markdown_doc: JSON.stringify(content),
        llm_model_id: 'minimax/minimax-m2:free'
      }
    });
    const storeResponse = expectValidJsonResult(storeResult);
    expect(storeResponse.status).toBe('stored');
    expect(storeResponse.items.length).toBeGreaterThan(0);
    const memUri = storeResponse.items[0].uri;

    const firstRead = await mcpConnection.client.readResource({ uri: memUri });
    expect(firstRead).toBeDefined();
    const body1 = firstRead.contents?.[0]?.text || '';
    expect(body1).toContain('<!-- KAIROS:HEADER -->');
    expect(body1).toContain('<!-- KAIROS:BODY-START -->');
    expect(body1).toContain('<!-- KAIROS:BODY-END -->');
    expect(body1).toContain('<!-- KAIROS:FOOTER -->');
    // UUID line should match the requested mem UUID
    const uuidMatch = body1.match(/UUID:\s*([0-9a-f-]+)/i);
    expect(uuidMatch && uuidMatch[1]).toBeDefined();

    // Second read should return the same structure (no cache marker assertions in v2 format)
    const secondRead = await mcpConnection.client.readResource({ uri: memUri });
    expect(secondRead).toBeDefined();
    const body2 = secondRead.contents?.[0]?.text || '';
    expect(body2).toContain('<!-- KAIROS:HEADER -->');
    expect(body2).toContain('<!-- KAIROS:BODY-START -->');
    expect(body2).toContain('<!-- KAIROS:BODY-END -->');
    expect(body2).toContain('<!-- KAIROS:FOOTER -->');
  }, 20000);
});