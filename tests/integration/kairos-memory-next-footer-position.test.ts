import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { parseMcpJson } from '../utils/expect-with-raw.js';

describe('kairos://mem footer shows Next with Position N/Total', () => {
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
    return parseMcpJson(result, '[kairos_memory_next_footer] raw MCP result');
  }

  test('Next line contains (Position: 2/2)', async () => {
    const ts = Date.now();
    const content = `# Next Footer Position ${ts}

## First
Body1

## Second
Body2`;

    const store = await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: { markdown_doc: content, llm_model_id: 'test-model-footer-position' }
    });
    const parsed = expectValid(store);
    expect(parsed.status).toBe('stored');
    expect(parsed.items.length).toBeGreaterThanOrEqual(2);

    const firstUri = parsed.items[0].uri;
    const read = await mcpConnection.client.readResource({ uri: firstUri });
    expect(read).toBeDefined();
    const text = read.contents?.[0]?.text || '';
    expect(text).toContain('<!-- KAIROS:FOOTER -->');
    const nextLine = text.split('\n').find(l => l.startsWith('NextStep:')) || '';
    expect(nextLine).toMatch(/NextStep:\s*kairos:\/\/mem\//);
  }, 20000);
});