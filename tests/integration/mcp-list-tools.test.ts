import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { withRawOnFail } from '../utils/expect-with-raw.js';

describe('MCP Tools Listing', () => {
  let mcpConnection;

  beforeAll(async () => {
    mcpConnection = await createMcpConnection();
  });

  afterAll(async () => {
    if (mcpConnection) {
      await mcpConnection.close();
    }
  });

  test('tools/list returns valid tool definitions', async () => {
    const result = await mcpConnection.client.listTools({});
    withRawOnFail(result, () => {
      expect(result).toBeDefined();
      expect(result.tools).toBeDefined();
      expect(Array.isArray(result.tools)).toBe(true);

      const tools = result.tools;
      expect(tools.length).toBeGreaterThan(0);

      // Validate schema for each tool
      tools.forEach((tool) => {
        expect(tool).toHaveProperty('name');
        expect(typeof tool.name).toBe('string');
        expect(tool).toHaveProperty('title');
        expect(typeof tool.title).toBe('string');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool.inputSchema).toHaveProperty('type');
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema).toHaveProperty('properties');
        expect(typeof tool.inputSchema.properties).toBe('object');
      });

      const names = tools.map((t) => t.name);
      // Ensure core tools are present
      expect(names).toContain('kairos_mint');
      expect(names).toContain('kairos_search');
      expect(names).toContain('kairos_begin');
    }, 'tools/list raw response');
  });
});
