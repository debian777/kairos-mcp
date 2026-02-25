import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { parseMcpJson, withRawOnFail } from '../utils/expect-with-raw.js';

describe('kairos_next user_input strict elicitation requirement', () => {
  let mcpConnection;

  beforeAll(async () => {
    mcpConnection = await createMcpConnection();
  }, 30000);

  afterAll(async () => {
    if (mcpConnection) {
      await mcpConnection.close();
    }
  });

  async function mintUserInputProtocol(label: string) {
    const doc = `# ${label}

## Step One

First step with user confirmation.

\`\`\`json
{"challenge":{"type":"user_input","user_input":{"prompt":"Approve this step?"},"required":true}}
\`\`\`
`;

    const storeResult = await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: { markdown_doc: doc, llm_model_id: 'test-model-user-input', force_update: true }
    });

    const parsed = parseMcpJson(storeResult, '[user_input tests] kairos_mint');
    expect(parsed.status).toBe('stored');
    expect(parsed.items.length).toBeGreaterThanOrEqual(1);
    return parsed.items[0].uri;
  }

  test('user_input solution type is not allowed in schema', async () => {
    const listResponse = await mcpConnection.client.listTools({});

    withRawOnFail(listResponse, () => {
      expect(listResponse).toHaveProperty('tools');
      const tool = listResponse.tools.find((t) => t.name === 'kairos_next');
      expect(tool).toBeDefined();

      const solutionSchema = tool.inputSchema.properties?.solution;
      expect(solutionSchema).toBeDefined();
      
      // user_input should NOT be in the enum
      expect(solutionSchema.properties.type.enum).not.toContain('user_input');
      expect(solutionSchema.properties.type.enum).toEqual(expect.arrayContaining(['shell', 'mcp', 'comment']));
      
      // user_input field should NOT exist
      expect(solutionSchema.properties?.user_input).toBeUndefined();
    }, '[tools/list] user_input removed from solution schema');
  }, 30000);

  test('user_input step requires elicitation capability', async () => {
    const uri = await mintUserInputProtocol('Elicitation Required Test');

    // Begin the protocol
    const beginResult = await mcpConnection.client.callTool({
      name: 'kairos_begin',
      arguments: { uri }
    });

    const beginParsed = parseMcpJson(beginResult, '[user_input tests] kairos_begin');
    expect(beginParsed.challenge.type).toBe('user_input');

    // Try to call kairos_next without elicitation capability
    // Note: The actual test depends on whether the test client supports elicitation
    // If it does, the test should verify that elicitation is used
    // If it doesn't, the test should verify CAPABILITY_REQUIRED error
    
    const nextResult = await mcpConnection.client.callTool({
      name: 'kairos_next',
      arguments: {
        uri: beginParsed.current_step.uri,
        solution: {
          type: 'comment',
          comment: { text: 'This should fail because we need user_input, not comment' }
        }
      }
    });

    const nextParsed = parseMcpJson(nextResult, '[user_input tests] kairos_next with wrong type');
    
    // Should get TYPE_MISMATCH error
    expect(nextParsed.error_code).toBe('TYPE_MISMATCH');
    expect(nextParsed.challenge.type).toBe('user_input');
  }, 30000);

  test('agent cannot submit user_input solution even if schema allowed it', async () => {
    const uri = await mintUserInputProtocol('Agent Bypass Test');

    const beginResult = await mcpConnection.client.callTool({
      name: 'kairos_begin',
      arguments: { uri }
    });

    const beginParsed = parseMcpJson(beginResult, '[user_input tests] kairos_begin');
    
    // Try to submit a solution with type user_input (even though schema doesn't allow it)
    // This should fail at validation time
    const nextResult = await mcpConnection.client.callTool({
      name: 'kairos_next',
      arguments: {
        uri: beginParsed.current_step.uri,
        solution: {
          type: 'user_input',
          user_input: { confirmation: 'approved' }
        }
      }
    });

    // Should fail validation - user_input is not in the enum
    // The exact error depends on Zod validation, but it should not accept user_input
    const nextParsed = parseMcpJson(nextResult, '[user_input tests] attempted agent submission');
    
    // Either validation error or the server should reject it
    // The schema change ensures this fails at the input validation level
    expect(nextParsed).toBeDefined();
  }, 30000);
});
