import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { withRawOnFail } from '../utils/expect-with-raw.js';
import { schemaHasObjectBranchWithProps, schemaHasPropertyPath } from '../utils/mcp-list-tools-schema-helpers.js';

describe('forward input schema exposure', () => {
  let mcpConnection: Awaited<ReturnType<typeof createMcpConnection>>;

  beforeAll(async () => {
    mcpConnection = await createMcpConnection();
  }, 60000);

  afterAll(async () => {
    await mcpConnection.close();
  });

  test('tools/list includes forward inputSchema with uri and solution (may be union branch)', async () => {
    const listResponse = await mcpConnection.client.listTools({});
    withRawOnFail(listResponse, () => {
      const tool = listResponse.tools.find((t) => t.name === 'forward');
      expect(tool).toBeDefined();
      expect(tool?.inputSchema).toBeDefined();
      expect(schemaHasObjectBranchWithProps(tool?.inputSchema, ['uri', 'solution'])).toBe(true);
      expect(schemaHasPropertyPath(tool?.inputSchema, ['solution', 'mcp', 'success'])).toBe(true);
      expect(schemaHasPropertyPath(tool?.inputSchema, ['solution', 'comment', 'text'])).toBe(true);
      expect(String(tool?.description)).toContain('solution.type');
      expect(String(tool?.description)).toContain('omit');
      expect(String(tool?.description)).toContain('execution_id');
    }, '[tools/list] forward schema');
  });
});
