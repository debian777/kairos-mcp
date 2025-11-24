import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { parseMcpJson, withRawOnFail } from '../utils/expect-with-raw.js';

describe('kairos_next response schema', () => {
  let mcpConnection;

  beforeAll(async () => {
    mcpConnection = await createMcpConnection();
  }, 30000);

  afterAll(async () => {
    if (mcpConnection) await mcpConnection.close();
  });

  async function mintTwoStepProtocol(label: string) {
    const doc = `# ${label}

## Step One
First body for ${label}.

## Step Two
Second body for ${label}.`;

    const storeResult = await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: { markdown_doc: doc, llm_model_id: 'test-model-kairos-next' }
    });

    const parsed = parseMcpJson(storeResult, '[kairos_next tests] kairos_mint');
    expect(parsed.status).toBe('stored');
    expect(parsed.items.length).toBeGreaterThanOrEqual(2);
    return parsed.items;
  }

  test('returns continue payload with current_step + next_step', async () => {
    const ts = Date.now();
    const items = await mintTwoStepProtocol(`Kairos Next Schema ${ts}`);
    const firstUri = items[0].uri;
    const secondUri = items[1].uri;

    const call = { name: 'kairos_next', arguments: { uri: firstUri } };
    const result = await mcpConnection.client.callTool(call);
    const payload = parseMcpJson(result, '[kairos_next] continue payload');

    withRawOnFail({ call, result }, () => {
      expect(payload.must_obey).toBe(true);
      expect(payload.protocol_status).toBe('continue');
      expect(payload.current_step).toBeDefined();
      expect(payload.current_step.uri).toBe(firstUri);
      expect(payload.current_step.mimeType).toBe('text/markdown');
      expect(payload.current_step.content).toContain('First body');

      expect(payload.next_step).toBeDefined();
      expect(payload.next_step.uri).toBe(secondUri);
      expect(payload.next_step.position).toBe('2/2');
      expect(typeof payload.next_step.label).toBe('string');
      expect(payload.next_step.label.length).toBeGreaterThan(0);
    }, '[kairos_next] continue payload with raw result');
  }, 30000);

  test('returns completed payload when final step', async () => {
    const ts = Date.now();
    const items = await mintTwoStepProtocol(`Kairos Next Final ${ts}`);
    const lastUri = items[items.length - 1].uri;

    const call = { name: 'kairos_next', arguments: { uri: lastUri } };
    const result = await mcpConnection.client.callTool(call);
    const payload = parseMcpJson(result, '[kairos_next] completed payload');

    withRawOnFail({ call, result }, () => {
      expect(payload.must_obey).toBe(true);
      expect(payload.protocol_status).toBe('completed');
      expect(payload.current_step.uri).toBe(lastUri);
      expect(payload.current_step.content).toContain('Second body');
      expect(payload.next_step).toBeNull();
    }, '[kairos_next] completed payload with raw result');
  }, 30000);
});
