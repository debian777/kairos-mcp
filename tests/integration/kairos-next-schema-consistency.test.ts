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

  test('tools/list marks proof_of_work as required with new structure', async () => {
    const listResponse = await mcpConnection.client.listTools({});

    withRawOnFail(listResponse, () => {
      expect(listResponse).toHaveProperty('tools');
      const tool = listResponse.tools.find((t) => t.name === 'kairos_next');
      expect(tool).toBeDefined();

      const inputSchema = tool.inputSchema;
      expect(inputSchema).toBeDefined();
      expect(inputSchema.required).toEqual(expect.arrayContaining(['uri', 'proof_of_work']));

      const powSchema = inputSchema.properties?.proof_of_work;
      expect(powSchema).toBeDefined();
      expect(powSchema.type).toBe('object');
      expect(powSchema.required).toEqual(expect.arrayContaining(['type']));
      
      // Check for type enum
      expect(powSchema.properties?.type).toBeDefined();
      expect(powSchema.properties.type.enum).toEqual(expect.arrayContaining(['shell', 'mcp', 'user_input', 'comment']));
      
      // Check for type-specific fields
      expect(powSchema.properties?.shell).toBeDefined();
      expect(powSchema.properties?.mcp).toBeDefined();
      expect(powSchema.properties?.user_input).toBeDefined();
      expect(powSchema.properties?.comment).toBeDefined();
    }, '[tools/list] kairos_next schema');
  }, 30000);
});

