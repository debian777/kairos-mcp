import { createMcpConnection } from '../utils/mcp-client-utils.js';

/**
 * Kairos Mint integration tests (validation and error handling).
 *
 * Goals:
 * - Verify error handling for invalid inputs.
 * - When something goes wrong, surface the raw MCP result
 *   instead of wrapping it in an extra "Failed to parse..." error.
 */

describe('Kairos Mint Validation', () => {
  let mcpConnection;

  beforeAll(async () => {
    mcpConnection = await createMcpConnection();
  });

  afterAll(async () => {
    if (mcpConnection) {
      await mcpConnection.close();
    }
  });

  test('kairos_mint reports clear error for empty markdown_doc', async () => {
    const result = await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: {
        markdown_doc: '',
        llm_model_id: 'minimax/minimax-m2:free'
      }
    });

    // Empty markdown_doc should fail Zod validation on the server side.
    expect(result).toBeDefined();
    expect(result.isError).toBe(true);
    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Input validation error');
    expect(result.content[0].text).toContain('markdown_doc');
  });

  test('kairos_mint validates required parameters', async () => {
    // Test missing input
    const result1 = await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: {
        llm_model_id: 'minimax/minimax-m2:free'
      }
    });
    expect(result1.isError).toBe(true);
    expect(result1.content[0].text).toContain('Input validation error');
    expect(result1.content[0].text).toContain('markdown_doc');

    // Test missing llm_model_id
    const result2 = await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: {
        markdown_doc: 'test content'
      }
    });
    expect(result2.isError).toBe(true);
    expect(result2.content[0].text).toContain('Input validation error');
    expect(result2.content[0].text).toContain('llm_model_id');

    // Test empty llm_model_id
    const result3 = await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: {
        markdown_doc: 'test content',
        llm_model_id: ''
      }
    });
    expect(result3.isError).toBe(true);
    expect(result3.content[0].text).toContain('Input validation error');
    expect(result3.content[0].text).toContain('llm_model_id');
  });
});