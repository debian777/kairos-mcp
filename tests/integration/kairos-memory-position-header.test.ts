import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { parseMcpJson } from '../utils/expect-with-raw.js';

describe('kairos://mem header renders Position N/Total', () => {
  let mcpConnection;

  beforeAll(async () => {
    mcpConnection = await createMcpConnection();
  }, 30000);

  afterAll(async () => {
    if (mcpConnection) {
      await mcpConnection.close();
    }
  });

  function expectValid(result) {
    return parseMcpJson(result, '[kairos_memory_position] raw MCP result');
  }

  test('header includes Position line', async () => {
    const content = `# Position Header Smoke ${Date.now()}

Single step body to ensure Position is 1/1.`;
    const store = await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: { markdown_doc: content, llm_model_id: 'test-model-position-header' }
    });
    const parsed = expectValid(store);
    expect(parsed.status).toBe('stored');
    expect(parsed.items.length).toBeGreaterThan(0);

    const memUri = parsed.items[0].uri;
    const read = await mcpConnection.client.readResource({ uri: memUri });
    expect(read).toBeDefined();
    const text = read.contents?.[0]?.text || '';
    expect(text).toContain('<!-- KAIROS:HEADER -->');
    expect(text).toMatch(/Position:\s*\d+\/\d+/);
  }, 20000);
});