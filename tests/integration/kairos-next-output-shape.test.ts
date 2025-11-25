console.debug('kairos-next-output-shape.test.ts');

import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { parseMcpJson, withRawOnFail } from '../utils/expect-with-raw.js';
import { buildProofMarkdown } from '../utils/proof-of-work.js';

console.debug('kairos-next-output-shape.test.ts');
describe('kairos_next response schema', () => {
  let mcpConnection;

  beforeAll(async () => {
    mcpConnection = await createMcpConnection();
  }, 30000);

  afterAll(async () => {
    if (mcpConnection) await mcpConnection.close();
  });

  async function mintTwoStepProtocol(label: string) {
    const doc = buildProofMarkdown(label, [
      { heading: 'Step One', body: `First body for ${label}.`, proofCmd: 'echo step1' },
      { heading: 'Step Two', body: `Second body for ${label}.`, proofCmd: 'echo step2' }
    ]);

    const storeResult = await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: { markdown_doc: doc, llm_model_id: 'test-model-kairos-next' }
    });

    const parsed = parseMcpJson(storeResult, '[kairos_next tests] kairos_mint');
    expect(parsed.status).toBe('stored');
    expect(parsed.items.length).toBeGreaterThanOrEqual(2);
    return parsed.items;
  }
  console.debug('mcpConnection', mcpConnection);

  test('returns continue payload with current_step + next_step', async () => {
    const ts = Date.now();
    const items = await mintTwoStepProtocol(`Kairos Next Schema ${ts}`);
    const firstUri = items[0].uri;
    const secondUri = items[1].uri;

    const call = { name: 'kairos_next', arguments: { uri: firstUri } };
    console.debug('call', call);
    const result = await mcpConnection.client.callTool(call);
    console.debug('result', result);
    const payload = parseMcpJson(result, '[kairos_next] continue payload');

    withRawOnFail({ call, result }, () => {
      expect(payload.must_obey).toBe(true);
      expect(payload.protocol_status).toBe('continue');
      expect(payload.current_step).toBeDefined();
      expect(payload.current_step.uri).toBe(firstUri);
      expect(payload.current_step.mimeType).toBe('text/markdown');
      expect(payload.current_step.content).toContain('First body');
      expect(payload.proof_of_work).toBeDefined();
      expect(payload.proof_of_work!.cmd).toContain('step1');
      expect(payload.proof_of_work!.timeout_seconds).toBe(30);
      expect(payload.proof_of_work_result).toBeUndefined();

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

    const submission = {
      uri: items[0].uri,
      exit_code: 0,
      stdout: 'setup ok'
    };
    const call = { name: 'kairos_next', arguments: { uri: lastUri, proof_of_work_result: submission } };
    const result = await mcpConnection.client.callTool(call);
    const payload = parseMcpJson(result, '[kairos_next] completed payload');

    withRawOnFail({ call, result }, () => {
      expect(payload.must_obey).toBe(true);
      expect(payload.protocol_status).toBe('completed');
      expect(payload.current_step.uri).toBe(lastUri);
      expect(payload.current_step.content).toContain('Second body');
      expect(payload.next_step).toBeNull();
      expect(payload.proof_of_work).toBeDefined();
      expect(payload.proof_of_work!.cmd).toContain('step2');
      expect(payload.proof_of_work_result).toBeUndefined();
    }, '[kairos_next] completed payload with raw result');
  }, 30000);
});
