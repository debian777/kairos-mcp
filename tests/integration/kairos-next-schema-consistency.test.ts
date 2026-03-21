import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { withRawOnFail } from '../utils/expect-with-raw.js';

describe('forward input schema exposure', () => {
  let mcpConnection: Awaited<ReturnType<typeof createMcpConnection>>;

  beforeAll(async () => {
    mcpConnection = await createMcpConnection();
  }, 60000);

  afterAll(async () => {
    await mcpConnection.close();
  });

  test('tools/list includes forward with object inputSchema', async () => {
    const listResponse = await mcpConnection.client.listTools({});
    withRawOnFail(listResponse, () => {
      const tool = listResponse.tools.find((t) => t.name === 'forward');
      expect(tool).toBeDefined();
      expect(tool?.inputSchema).toBeDefined();
      expect(tool?.inputSchema.type).toBe('object');
      const props = tool?.inputSchema.properties as Record<string, unknown> | undefined;
      expect(props).toBeDefined();
      expect(props).toHaveProperty('uri');
      expect(props).toHaveProperty('solution');
    }, '[tools/list] forward schema');
  });
});
