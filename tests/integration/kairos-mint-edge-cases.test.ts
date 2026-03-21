import { createMcpConnection } from '../utils/mcp-client-utils.js';

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

  test('train rejects documents without required structure (PROTOCOL_STRUCTURE_INVALID)', async () => {
    // Document without H1, H2, or challenge blocks is rejected by validation gate
    const simpleContent = `This is a simple document without any markdown headers. ${Date.now()}`;

    const result = await mcpConnection.client.callTool({
      name: 'train',
      arguments: {
        markdown_doc: simpleContent,
        llm_model_id: 'minimax/minimax-m2:free',
        force_update: true
      }
    });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0].text);
    expect(body.error).toBe('PROTOCOL_STRUCTURE_INVALID');
    expect(body.must_obey).toBe(true);
    expect(body.next_action).toContain('forward');
    expect(body.next_action).toContain('00000000-0000-0000-0000-000000002001');
    expect(Array.isArray(body.missing)).toBe(true);
  });

});