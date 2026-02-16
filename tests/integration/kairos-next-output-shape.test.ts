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
      arguments: { markdown_doc: doc, llm_model_id: 'test-model-kairos-next', force_update: true }
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
      arguments: { markdown_doc: doc, llm_model_id: 'test-model-kairos-next', force_update: true }
    });

    const parsed = parseMcpJson(storeResult, '[kairos_next tests] kairos_mint');
    expect(parsed.status).toBe('stored');
    expect(parsed.items.length).toBeGreaterThanOrEqual(3);
    return parsed.items;
  }
  console.debug('mcpConnection', mcpConnection);

  test('returns continue payload with current_step and challenge', async () => {
    const ts = Date.now();
    const items = await mintThreeStepProtocol(`Kairos Next Schema ${ts}`);
    const firstUri = items[0].uri;
    const secondUri = items[1].uri;

    // Step 1: Use kairos_begin (no POW required)
    const beginResult = await mcpConnection.client.callTool({
      name: 'kairos_begin',
      arguments: { uri: firstUri }
    });
    const beginPayload = parseMcpJson(beginResult, '[kairos_begin] step 1');
    expect(typeof beginPayload.next_action).toBe('string');
    expect(beginPayload.next_action).toContain('kairos://mem/');
    expect(beginPayload.challenge).toBeDefined();

    // Step 2: Use kairos_next with solution for step 1 (uri = step we're completing, i.e. firstUri)
    const solution = {
      type: 'comment',
      comment: { text: 'Test solution for step 1 completion' }
    };
    const call = { name: 'kairos_next', arguments: { uri: firstUri, solution: solution } };
    console.debug('call', call);
    const result = await mcpConnection.client.callTool(call);
    console.debug('result', result);
    const payload = parseMcpJson(result, '[kairos_next] continue payload');

    withRawOnFail({ call, result }, () => {
      expect(payload.must_obey).toBe(true);
      expect(payload.current_step).toBeDefined();
      expect(payload.current_step.uri).toBe(secondUri);
      expect(payload.current_step.mimeType).toBe('text/markdown');
      expect(payload.current_step.content).toContain('Second body');
      expect(payload.challenge).toBeDefined();
      // Challenge structure has type and shell fields
      if (payload.challenge.shell) {
        expect(payload.challenge.shell.cmd).toContain('step2');
        expect(payload.challenge.shell.timeout_seconds).toBe(30);
      }
      // V2: next_action with embedded URI replaces next_step and protocol_status
      expect(typeof payload.next_action).toBe('string');
      expect(payload.next_action).toContain('kairos://mem/');
      // V2: proof_hash replaces last_proof_hash
      if (payload.proof_hash) {
        expect(typeof payload.proof_hash).toBe('string');
      }
      // V1 fields must NOT exist
      expect(payload.next_step).toBeUndefined();
      expect(payload.protocol_status).toBeUndefined();
      expect(payload.last_proof_hash).toBeUndefined();
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

    // Step 2: Use kairos_next with solution for step 1 (uri = step we're completing, i.e. firstUri)
    const submission = {
      type: 'comment',
      comment: { text: 'Test solution for step 1 completion' }
    };
    const call = { name: 'kairos_next', arguments: { uri: firstUri, solution: submission } };
    const result = await mcpConnection.client.callTool(call);
    const payload = parseMcpJson(result, '[kairos_next] completed payload');

    withRawOnFail({ call, result }, () => {
      expect(payload.must_obey).toBe(true);
      expect(payload.current_step.uri).toBe(lastUri);
      expect(payload.current_step.content).toContain('Second body');
      expect(payload.challenge).toBeDefined();
      // Challenge structure has type and shell fields
      if (payload.challenge.shell) {
        expect(payload.challenge.shell.cmd).toContain('step2');
      }
      // V2: next_action says call kairos_attest for final step
      expect(typeof payload.next_action).toBe('string');
      expect(payload.next_action).toContain('kairos_attest');
      expect(payload.next_action).toContain('kairos://mem/');
      // V1 fields must NOT exist
      expect(payload.final_challenge).toBeUndefined();
      expect(payload.protocol_status).toBeUndefined();
      expect(payload.attest_required).toBeUndefined();
      expect(payload.next_step).toBeUndefined();
    }, '[kairos_next] completed payload with raw result');
  }, 30000);
});
