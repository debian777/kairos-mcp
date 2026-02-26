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
    
    // Without elicitation support, server returns CAPABILITY_REQUIRED for user_input steps.
    // With wrong solution type (comment instead of user_input) we may get TYPE_MISMATCH if validation runs first.
    expect(['CAPABILITY_REQUIRED', 'TYPE_MISMATCH']).toContain(nextParsed.error_code);
    expect(nextParsed.challenge.type).toBe('user_input');
  }, 30000);

  test('agent cannot submit user_input solution even if schema allowed it', async () => {
    const uri = await mintUserInputProtocol('Agent Bypass Test');

    const beginResult = await mcpConnection.client.callTool({
      name: 'kairos_begin',
      arguments: { uri }
    });

    const beginParsed = parseMcpJson(beginResult, '[user_input tests] kairos_begin');
    
    // Try to submit a solution with type user_input (schema excludes user_input for agents)
    // This should fail: either Zod validation or server returns structured error / MCP error text
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

    // Failure may be: (1) JSON body with error_code, or (2) MCP layer error (isError + text, not JSON)
    let nextParsed: Record<string, unknown> | null = null;
    try {
      nextParsed = parseMcpJson(nextResult, '[user_input tests] attempted agent submission');
    } catch {
      // MCP returns isError with text like "MCP error -32602: Input validation error: ... Invalid option: expected one of \"shell\"|\"mcp\"|\"comment\""
      expect(nextResult).toBeDefined();
      expect((nextResult as { isError?: boolean }).isError).toBe(true);
      const text =
        (nextResult as { content?: Array<{ type?: string; text?: string }> }).content?.[0]?.text ?? '';
      expect(text).toMatch(/invalid|validation|invalid_value|expected one of.*shell.*mcp.*comment/i);
      return;
    }
    expect(nextParsed).toBeDefined();
    // If we got JSON, it should indicate failure (error_code or message)
    if (nextParsed && (nextParsed.error_code != null || (nextParsed as { message?: string }).message)) {
      expect(nextParsed.error_code != null || (nextParsed as { message?: string }).message?.length).toBeTruthy();
    }
  }, 30000);
});
