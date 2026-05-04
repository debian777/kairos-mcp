import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { parseMcpJson } from '../utils/expect-with-raw.js';

const UUID_ADAPTER_URI = 'kairos://adapter/00000000-0000-0000-0000-000000000001';

describe('wire adapter URI contract (slug-only)', () => {
  let mcpConnection: Awaited<ReturnType<typeof createMcpConnection>>;

  beforeAll(async () => {
    mcpConnection = await createMcpConnection();
  }, 60000);

  afterAll(async () => {
    await mcpConnection.close();
  });

  test('forward rejects adapter UUID with dedicated teaching branch and example', async () => {
    const result = await mcpConnection.client.callTool({
      name: 'forward',
      arguments: { uri: UUID_ADAPTER_URI }
    });
    const parsed = parseMcpJson(result, 'forward uuid rejection');
    expect(parsed.error).toBe('INVALID_TOOL_INPUT');
    expect(parsed.tool).toBe('forward');
    expect(String(parsed.message)).toContain('slug-only');
    expect(String(parsed.next_action)).toContain('choices[].forward_first_call.uri');
    expect(parsed.example).toEqual({ uri: 'kairos://adapter/phase-critic' });
  });

  test.each([
    ['tune', { uris: [UUID_ADAPTER_URI], content: ['# tuned'] }],
    ['delete', { uris: [UUID_ADAPTER_URI] }],
    ['export', { uri: UUID_ADAPTER_URI, format: 'markdown' }],
    ['train', { llm_model_id: 'slug-only-test', source_adapter_uri: UUID_ADAPTER_URI, content: '# local content' }]
  ] as const)('%s rejects adapter UUID input', async (toolName, arguments_) => {
    const result = await mcpConnection.client.callTool({
      name: toolName,
      arguments: arguments_ as unknown as Record<string, unknown>
    });
    const parsed = parseMcpJson(result, `${toolName} uuid rejection`);
    expect(parsed.error).toBe('INVALID_TOOL_INPUT');
    expect(parsed.tool).toBe(toolName);
    expect(Array.isArray(parsed.invalid_fields)).toBe(true);
    expect(parsed.example).toBeDefined();
  });
});
