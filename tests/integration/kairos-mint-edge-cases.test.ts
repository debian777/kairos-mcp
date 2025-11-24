import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { parseMcpJson } from '../utils/expect-with-raw.js';

/**
 * Kairos Mint integration tests (edge cases).
 *
 * Goals:
 * - Verify fallback behavior and caching.
 * - When something goes wrong, surface the raw MCP result
 *   instead of wrapping it in an extra "Failed to parse..." error.
 */

describe('Kairos Mint Edge Cases', () => {
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

  test('kairos_mint falls back to single memory for documents without headers', async () => {
    // Document without proper H1/H2 headers
    const simpleContent = `This is a simple document without any markdown headers. It should still be stored as a single memory. ${Date.now()}`;

    const result = await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: {
        markdown_doc: simpleContent,
        llm_model_id: 'minimax/minimax-m2:free'
      }
    });

    const response = expectValidJsonResult(result);

    expect(response).toHaveProperty('items');
    expect(Array.isArray(response.items)).toBe(true);
    expect(response.items).toHaveLength(1); // Should fallback to single memory

    const item = response.items[0];
    expect(item).toHaveProperty('uri');
    expect(item.uri).toMatch(/^kairos:\/\/mem\//);
    expect(item).toHaveProperty('memory_uuid');
    expect(typeof item.memory_uuid).toBe('string');
    expect(item.memory_uuid.length).toBeGreaterThan(0);
    expect(item).toHaveProperty('label');
    expect(typeof item.label).toBe('string');
    expect(item).toHaveProperty('tags');
    expect(Array.isArray(item.tags)).toBe(true);

    expect(response).toHaveProperty('status');
    expect(response.status).toBe('stored');
  });

});