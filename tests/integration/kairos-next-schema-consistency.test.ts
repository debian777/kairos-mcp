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

  test('tools/list marks solution as required with new structure', async () => {
    const listResponse = await mcpConnection.client.listTools({});

    withRawOnFail(listResponse, () => {
      expect(listResponse).toHaveProperty('tools');
      const tool = listResponse.tools.find((t) => t.name === 'kairos_next');
      expect(tool).toBeDefined();

      const inputSchema = tool.inputSchema;
      expect(inputSchema).toBeDefined();
      expect(inputSchema.required).toEqual(expect.arrayContaining(['uri', 'solution']));

      const solutionSchema = inputSchema.properties?.solution;
      expect(solutionSchema).toBeDefined();
      expect(solutionSchema.type).toBe('object');
      expect(solutionSchema.required).toEqual(expect.arrayContaining(['type']));
      
      // Check for type enum (user_input removed - handled server-side via elicitation)
      expect(solutionSchema.properties?.type).toBeDefined();
      expect(solutionSchema.properties.type.enum).toEqual(expect.arrayContaining(['shell', 'mcp', 'comment']));
      expect(solutionSchema.properties.type.enum).not.toContain('user_input');
      
      // Check for type-specific fields (user_input removed)
      expect(solutionSchema.properties?.shell).toBeDefined();
      expect(solutionSchema.properties?.mcp).toBeDefined();
      expect(solutionSchema.properties?.comment).toBeDefined();
      expect(solutionSchema.properties?.user_input).toBeUndefined();
    }, '[tools/list] kairos_next schema');
  }, 30000);
});

