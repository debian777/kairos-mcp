/**
 * V2 kairos_attest response shape tests.
 * Validates the schema from docs/workflow-kairos-attest.md.
 * Key change: no final_solution required.
 * These tests are expected to FAIL against v1 code.
 *
 * Also asserts no additional properties on results[] (MCP outputSchema has additionalProperties: false).
 * See reports/new/mcp-bug-user-KAIROS-kairos-attest-schema-mismatch-2026-03-13.md.
 */
import { createMcpConnection } from '../utils/mcp-client-utils.js';

/** Allowed keys for each result item; must match tool outputSchema (additionalProperties: false). */
const ATTEST_RESULT_KEYS = ['uri', 'outcome', 'quality_bonus', 'message', 'rated_at'] as const;
import { parseMcpJson, withRawOnFail } from '../utils/expect-with-raw.js';
import { buildProofMarkdown } from '../utils/proof-of-work.js';

describe('V2 kairos_attest response schema', () => {
  let mcpConnection;

  beforeAll(async () => {
    mcpConnection = await createMcpConnection();
  }, 30000);

  afterAll(async () => {
    if (mcpConnection) await mcpConnection.close();
  });

  async function mintAndWalkToEnd(label: string) {
    const doc = buildProofMarkdown(label, [
      { heading: 'Step One', body: `First body for ${label}.`, proofCmd: 'echo step1' },
      { heading: 'Step Two', body: `Second body for ${label}.`, proofCmd: 'echo step2' }
    ]);
    const storeResult = await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: { markdown_doc: doc, llm_model_id: 'test-v2-attest', force_update: true }
    });
    const stored = parseMcpJson(storeResult, 'v2-attest mint');
    expect(stored.status).toBe('stored');
    const items = stored.items;

    // Begin step 1
    const beginResult = await mcpConnection.client.callTool({
      name: 'kairos_begin',
      arguments: { uri: items[0].uri }
    });
    const beginPayload = parseMcpJson(beginResult, 'v2-attest begin');
    const nonce = beginPayload.challenge?.nonce;
    const proofHash = beginPayload.challenge?.proof_hash || beginPayload.challenge?.genesis_hash;

    // Step 1 -> 2
    const nextResult = await mcpConnection.client.callTool({
      name: 'kairos_next',
      arguments: {
        uri: items[1].uri,
        solution: { type: 'shell', nonce, proof_hash: proofHash, shell: { exit_code: 0, stdout: 'step1' } }
      }
    });
    const nextPayload = parseMcpJson(nextResult, 'v2-attest next');
    return { lastUri: items[1].uri, nextPayload };
  }

  test('success attestation: no final_solution required, returns results array', async () => {
    const ts = Date.now();
    const { lastUri } = await mintAndWalkToEnd(`V2Attest Success ${ts}`);

    // V2: attest with just uri, outcome, message (no final_solution)
    const call = {
      name: 'kairos_attest',
      arguments: {
        uri: lastUri,
        outcome: 'success',
        message: 'All steps completed successfully.'
      }
    };
    const result = await mcpConnection.client.callTool(call);
    const parsed = parseMcpJson(result, 'v2-attest success');

    withRawOnFail({ call, result }, () => {
      expect(Array.isArray(parsed.results)).toBe(true);
      expect(parsed.results.length).toBeGreaterThanOrEqual(1);

      const r = parsed.results[0];
      expect(r.uri).toBe(lastUri);
      expect(r.outcome).toBe('success');
      expect(typeof r.quality_bonus).toBe('number');
      expect(typeof r.message).toBe('string');
      expect(typeof r.rated_at).toBe('string');

      // MCP schema has additionalProperties: false; extra keys cause -32602 (schema mismatch).
      const resultKeys = Object.keys(r).sort();
      expect(resultKeys).toEqual([...ATTEST_RESULT_KEYS].sort());

      expect(typeof parsed.total_rated).toBe('number');
      expect(typeof parsed.total_failed).toBe('number');
    });
  });

  test('failure attestation: no final_solution required', async () => {
    const ts = Date.now();
    const { lastUri } = await mintAndWalkToEnd(`V2Attest Failure ${ts}`);

    const call = {
      name: 'kairos_attest',
      arguments: {
        uri: lastUri,
        outcome: 'failure',
        message: 'Step failed: permission denied.'
      }
    };
    const result = await mcpConnection.client.callTool(call);
    const parsed = parseMcpJson(result, 'v2-attest failure');

    withRawOnFail({ call, result }, () => {
      expect(Array.isArray(parsed.results)).toBe(true);
      const r = parsed.results[0];
      expect(r.outcome).toBe('failure');
      expect(typeof r.quality_bonus).toBe('number');
      expect(Object.keys(r).sort()).toEqual([...ATTEST_RESULT_KEYS].sort());
    });
  });
});
