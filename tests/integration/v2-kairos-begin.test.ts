/**
 * V2 kairos_begin response shape tests.
 * Validates the schema from docs/workflow-kairos-begin.md.
 * These tests are expected to FAIL against v1 code.
 */
import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { parseMcpJson, withRawOnFail } from '../utils/expect-with-raw.js';
import { buildProofMarkdown } from '../utils/proof-of-work.js';

describe('V2 kairos_begin response schema', () => {
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
      arguments: { markdown_doc: doc, llm_model_id: 'test-v2-begin', force_update: true }
    });
    const parsed = parseMcpJson(storeResult, 'v2-begin mint');
    expect(parsed.status).toBe('stored');
    return parsed.items;
  }

  test('multi-step: must_obey true, next_action with URI, proof_hash in challenge, no next_step', async () => {
    const ts = Date.now();
    const items = await mintTwoStepProtocol(`V2Begin Multi ${ts}`);
    const firstUri = items[0].uri;

    const call = { name: 'kairos_begin', arguments: { uri: firstUri } };
    const result = await mcpConnection.client.callTool(call);
    const parsed = parseMcpJson(result, 'v2-begin');

    withRawOnFail({ call, result }, () => {
      // V2 required fields
      expect(parsed.must_obey).toBe(true);
      expect(parsed.current_step).toBeDefined();
      expect(parsed.current_step.uri).toMatch(/^kairos:\/\/mem\//);
      expect(parsed.current_step.mimeType).toBe('text/markdown');
      expect(parsed.challenge).toBeDefined();
      expect(parsed.challenge.type).toBeDefined();
      expect(parsed.challenge.description).toBeDefined();

      // proof_hash replaces genesis_hash
      expect(parsed.challenge.proof_hash).toBeDefined();
      expect(parsed.challenge.genesis_hash).toBeUndefined();

      // next_action with embedded URI
      expect(typeof parsed.next_action).toBe('string');
      expect(parsed.next_action).toContain('kairos://mem/');
      expect(parsed.next_action).toContain('kairos_next');

      // V1 fields must NOT exist
      expect(parsed.next_step).toBeUndefined();
      expect(parsed.protocol_status).toBeUndefined();
      expect(parsed.attest_required).toBeUndefined();
      expect(parsed.final_challenge).toBeUndefined();
    });
  });

  test('auto-redirect: non-step-1 URI returns step 1', async () => {
    const ts = Date.now();
    const items = await mintTwoStepProtocol(`V2Begin Redirect ${ts}`);
    const secondUri = items[1].uri;
    const firstUri = items[0].uri;

    const call = { name: 'kairos_begin', arguments: { uri: secondUri } };
    const result = await mcpConnection.client.callTool(call);
    const parsed = parseMcpJson(result, 'v2-begin redirect');

    withRawOnFail({ call, result }, () => {
      // Should auto-redirect to step 1
      expect(parsed.must_obey).toBe(true);
      expect(parsed.current_step).toBeDefined();
      expect(parsed.current_step.uri).toBe(firstUri);
      expect(parsed.message).toContain('Redirected');
      expect(typeof parsed.next_action).toBe('string');

      // NOT a blocked error
      expect(parsed.protocol_status).toBeUndefined();
    });
  });

  test('single-step: next_action says run complete, no final_challenge', async () => {
    const ts = Date.now();
    const doc = `# V2Begin Single ${ts}\n\n## Only Step\nDo the thing.\n\nPROOF OF WORK: comment min_length=10`;
    const storeResult = await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: { markdown_doc: doc, llm_model_id: 'test-v2-begin', force_update: true }
    });
    const stored = parseMcpJson(storeResult, 'v2-begin single mint');
    const uri = stored.items[0].uri;

    const call = { name: 'kairos_begin', arguments: { uri } };
    const result = await mcpConnection.client.callTool(call);
    const parsed = parseMcpJson(result, 'v2-begin single');

    withRawOnFail({ call, result }, () => {
      expect(parsed.must_obey).toBe(true);
      expect(parsed.next_action).toMatch(/run complete/i);

      // No final_challenge or final_solution references
      expect(parsed.final_challenge).toBeUndefined();
      expect(parsed.attest_required).toBeUndefined();
    });
  });
});
