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

  async function mintThreeStepProtocol(label: string) {
    const doc = buildProofMarkdown(label, [
      { heading: 'Step One', body: `First body for ${label}.`, proofCmd: 'echo step1' },
      { heading: 'Step Two', body: `Second body for ${label}.`, proofCmd: 'echo step2' },
      { heading: 'Step Three', body: `Third body for ${label}.`, proofCmd: 'echo step3' }
    ]);

    const storeResult = await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: { markdown_doc: doc, llm_model_id: 'test-model-kairos-next' }
    });

    const parsed = parseMcpJson(storeResult, '[kairos_next tests] kairos_mint');
    expect(parsed.status).toBe('stored');
    expect(parsed.items.length).toBeGreaterThanOrEqual(3);
    return parsed.items;
  }
  console.debug('mcpConnection', mcpConnection);

  test('returns continue payload with current_step + next_step', async () => {
    const ts = Date.now();
    const items = await mintThreeStepProtocol(`Kairos Next Schema ${ts}`);
    const firstUri = items[0].uri;
    const secondUri = items[1].uri;
    const thirdUri = items[2].uri;

    // Step 1: Use kairos_begin (no POW required)
    const beginResult = await mcpConnection.client.callTool({
      name: 'kairos_begin',
      arguments: { uri: firstUri }
    });
    const beginPayload = parseMcpJson(beginResult, '[kairos_begin] step 1');
    expect(beginPayload.next_step).toBeDefined();
    expect(beginPayload.next_step.uri).toBe(secondUri);

    // Step 2: Use kairos_next with proof_of_work for step 1
    const proofOfWork = {
      type: 'comment',
      comment: { text: 'Test proof of work for step 1 completion' }
    };
    const call = { name: 'kairos_next', arguments: { uri: secondUri, proof_of_work: proofOfWork } };
    console.debug('call', call);
    const result = await mcpConnection.client.callTool(call);
    console.debug('result', result);
    const payload = parseMcpJson(result, '[kairos_next] continue payload');

    withRawOnFail({ call, result }, () => {
      expect(payload.must_obey).toBe(true);
      expect(payload.protocol_status).toBe('continue'); // Step 2 has step 3 next
      expect(payload.current_step).toBeDefined();
      expect(payload.current_step.uri).toBe(secondUri);
      expect(payload.current_step.mimeType).toBe('text/markdown');
      expect(payload.current_step.content).toContain('Second body');
      expect(payload.proof_of_work_required).toBeDefined();
      // New structure: proof_of_work_required has type and shell fields
      if (payload.proof_of_work_required.shell) {
        expect(payload.proof_of_work_required.shell.cmd).toContain('step2');
        expect(payload.proof_of_work_required.shell.timeout_seconds).toBe(30);
      } else if (payload.proof_of_work_required.cmd) {
        // Backward compatibility
        expect(payload.proof_of_work_required.cmd).toContain('step2');
        expect(payload.proof_of_work_required.timeout_seconds).toBe(30);
      }
      expect(payload.proof_of_work_result).toBeUndefined();

      expect(payload.next_step).toBeDefined();
      expect(payload.next_step.uri).toBe(thirdUri);
      expect(payload.next_step.position).toBe('3/3');
      expect(typeof payload.next_step.label).toBe('string');
      expect(payload.next_step.label.length).toBeGreaterThan(0);
    }, '[kairos_next] continue payload with raw result');
  }, 30000);

  test('returns completed payload when final step', async () => {
    const ts = Date.now();
    const items = await mintTwoStepProtocol(`Kairos Next Final ${ts}`);
    const firstUri = items[0].uri;
    const lastUri = items[items.length - 1].uri;

    // Step 1: Use kairos_begin (no POW required)
    await mcpConnection.client.callTool({
      name: 'kairos_begin',
      arguments: { uri: firstUri }
    });

    // Step 2: Use kairos_next with proof_of_work for step 1
    const submission = {
      type: 'comment',
      comment: { text: 'Test proof of work for step 1 completion' }
    };
    const call = { name: 'kairos_next', arguments: { uri: lastUri, proof_of_work: submission } };
    const result = await mcpConnection.client.callTool(call);
    const payload = parseMcpJson(result, '[kairos_next] completed payload');

    withRawOnFail({ call, result }, () => {
      expect(payload.must_obey).toBe(true);
      expect(payload.protocol_status).toBe('completed');
      expect(payload.current_step.uri).toBe(lastUri);
      expect(payload.current_step.content).toContain('Second body');
      expect(payload.next_step).toBeNull();
      expect(payload.proof_of_work_required).toBeDefined();
      // New structure: proof_of_work_required has type and shell fields
      if (payload.proof_of_work_required.shell) {
        expect(payload.proof_of_work_required.shell.cmd).toContain('step2');
      } else if (payload.proof_of_work_required.cmd) {
        // Backward compatibility
        expect(payload.proof_of_work_required.cmd).toContain('step2');
      }
      expect(payload.proof_of_work_result).toBeUndefined();
    }, '[kairos_next] completed payload with raw result');
  }, 30000);
});
