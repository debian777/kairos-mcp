import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { withRawOnFail } from '../utils/expect-with-raw.js';

describe('kairos_next input schema exposure', () => {
  let mcpConnection;

  beforeAll(async () => {
    mcpConnection = await createMcpConnection();
  }, 30000);

  afterAll(async () => {
    if (mcpConnection) {
      await mcpConnection.close();
    }
  });

  test('tools/list marks proof_of_work_result as optional with strict fields', async () => {
    const listResponse = await mcpConnection.client.listTools({});

    withRawOnFail(listResponse, () => {
      expect(listResponse).toHaveProperty('tools');
      const tool = listResponse.tools.find((t) => t.name === 'kairos_next');
      expect(tool).toBeDefined();

      const inputSchema = tool.inputSchema;
      expect(inputSchema).toBeDefined();
      expect(inputSchema.required).toEqual(['uri']);

      const powSchema = inputSchema.properties?.proof_of_work_result;
      expect(powSchema).toBeDefined();
      expect(typeof powSchema.description).toBe('string');
      expect(powSchema.description.toLowerCase()).toContain('omit entirely');

      expect(powSchema.required).toEqual(expect.arrayContaining(['uri', 'exit_code']));
      expect(powSchema.properties?.uri?.pattern).toBe('^kairos:\\/\\/mem\\/[0-9a-f-]{36}$');
    }, '[tools/list] kairos_next schema');
  }, 30000);
});

