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

  test('kairos_mint returns PROTOCOL_STRUCTURE_INVALID for incomplete markdown', async () => {
    const incompleteMd = `# My Protocol

## Step 1 First
Content without Natural Language Triggers section.

\`\`\`json
{"challenge":{"type":"comment","comment":{"min_length":10},"required":true}}
\`\`\`

## Completion Rule
Done.`;

    const result = await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: {
        markdown_doc: incompleteMd,
        llm_model_id: 'minimax/minimax-m2:free'
      }
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe('text');
    const body = JSON.parse(result.content[0].text);
    expect(body.error).toBe('PROTOCOL_STRUCTURE_INVALID');
    expect(body.must_obey).toBe(true);
    expect(body.next_action).toContain('kairos_begin');
    expect(body.next_action).toContain('00000000-0000-0000-0000-000000002001');
    expect(Array.isArray(body.missing)).toBe(true);
    expect(body.missing).toContain('natural_language_triggers');
    expect(body.message).toMatch(/Natural Language Triggers|required structure/i);
  });

  test('kairos_mint returns PROTOCOL_STRUCTURE_INVALID for invalid challenge type placeholder', async () => {
    const badTypeMd = `# Bad Type Protocol ${Date.now()}

## Natural Language Triggers

Run when testing invalid challenge types.

## Step 1

Bad illustrative type.

\`\`\`json
{"challenge":{"type":"comment|user_input|mcp|shell","comment":{"min_length":10},"required":true}}
\`\`\`

## Completion Rule

Done.`;

    const result = await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: {
        markdown_doc: badTypeMd,
        llm_model_id: 'minimax/minimax-m2:free'
      }
    });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0].text);
    expect(body.error).toBe('PROTOCOL_STRUCTURE_INVALID');
    expect(body.missing).toContain('invalid_challenge_type');
    expect(body.message).toMatch(/shell, mcp, user_input, or comment/i);
  });

  test('kairos_mint stores valid markdown with required sections (no regression)', async () => {
    const validMd = `# Valid Protocol ${Date.now()}

## Natural Language Triggers
Run when user says "run valid protocol".

## Step 1
Do something.

\`\`\`json
{"challenge":{"type":"comment","comment":{"min_length":10},"required":true}}
\`\`\`

## Completion Rule
Only after all steps.`;

    const result = await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: {
        markdown_doc: validMd,
        llm_model_id: 'minimax/minimax-m2:free',
        force_update: true
      }
    });

    expect(result.isError).toBeFalsy();
    const body = JSON.parse(result.content[0].text);
    expect(body.status).toBe('stored');
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    expect(body.items[0].uri).toMatch(/^kairos:\/\/mem\//);
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