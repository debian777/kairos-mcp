/**
 * V2 kairos_next response shape tests.
 * Validates the schema from docs/workflow-kairos-next.md.
 * These tests are expected to FAIL against v1 code.
 */
import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { parseMcpJson, withRawOnFail } from '../utils/expect-with-raw.js';
import { buildProofMarkdown } from '../utils/proof-of-work.js';

const QDRANT_URL = process.env.QDRANT_URL ?? 'http://localhost:6333';
const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION ?? 'kb_resources';

async function getPointPayload(pointId: string): Promise<Record<string, unknown> | null> {
  try {
    const url = `${QDRANT_URL}/collections/${QDRANT_COLLECTION}/points/${pointId}?with_payload=true&with_vector=false`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.result?.payload ?? null;
  } catch {
    return null;
  }
}

describe('V2 kairos_next response schema', () => {
  let mcpConnection;

  beforeAll(async () => {
    mcpConnection = await createMcpConnection();
  }, 30000);

  afterAll(async () => {
    if (mcpConnection) await mcpConnection.close();
  });

  async function mintThreeStepProtocol(label: string) {
    const doc = buildProofMarkdown(label, [
      { heading: 'Step One', body: `First body for ${label}.`, proofCmd: 'echo step1' },
      { heading: 'Step Two', body: `Second body for ${label}.`, proofCmd: 'echo step2' },
      { heading: 'Step Three', body: `Third body for ${label}.`, proofCmd: 'echo step3' }
    ]);
    const storeResult = await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: { markdown_doc: doc, llm_model_id: 'test-v2-next', force_update: true }
    });
    const parsed = parseMcpJson(storeResult, 'v2-next mint');
    expect(parsed.status).toBe('stored');
    return parsed.items;
  }

  async function beginProtocol(uri: string) {
    const result = await mcpConnection.client.callTool({
      name: 'kairos_begin',
      arguments: { uri }
    });
    return parseMcpJson(result, 'v2-next begin');
  }

  test('continue: proof_hash naming, next_action with URI, no next_step', async () => {
    const ts = Date.now();
    const items = await mintThreeStepProtocol(`V2Next Continue ${ts}`);
    const firstUri = items[0].uri;
    const secondUri = items[1].uri;

    // Begin to get step 1 challenge
    const beginPayload = await beginProtocol(firstUri);
    const nonce = beginPayload.challenge?.nonce;
    // Use proof_hash (v2) or genesis_hash (v1 fallback for this test)
    const proofHash = beginPayload.challenge?.proof_hash || beginPayload.challenge?.genesis_hash;

    // Submit solution for step 1
    const call = {
      name: 'kairos_next',
      arguments: {
        uri: secondUri,
        solution: {
          type: 'shell',
          nonce,
          proof_hash: proofHash,
          shell: { exit_code: 0, stdout: 'step1', stderr: '', duration_seconds: 0.1 }
        }
      }
    };
    const result = await mcpConnection.client.callTool(call);
    const parsed = parseMcpJson(result, 'v2-next continue');

    withRawOnFail({ call, result }, () => {
      // V2 required fields
      expect(parsed.must_obey).toBe(true);
      expect(parsed.current_step).toBeDefined();
      expect(parsed.current_step.uri).toMatch(/^kairos:\/\/mem\//);
      expect(parsed.current_step.mimeType).toBe('text/markdown');
      expect(parsed.challenge).toBeDefined();

      // next_action with embedded URI
      expect(typeof parsed.next_action).toBe('string');
      expect(parsed.next_action).toContain('kairos://mem/');

      // proof_hash (top-level) replaces last_proof_hash
      if (parsed.proof_hash) {
        expect(typeof parsed.proof_hash).toBe('string');
      }
      expect(parsed.last_proof_hash).toBeUndefined();

      // V1 fields must NOT exist
      expect(parsed.next_step).toBeUndefined();
      expect(parsed.protocol_status).toBeUndefined();
      expect(parsed.attest_required).toBeUndefined();
      expect(parsed.final_challenge).toBeUndefined();
    });

    // Workflow quality: completed step (step 1) should have quality_metadata updated by kairos_next
    const step1Uuid = items[0].memory_uuid;
    const payload = await getPointPayload(step1Uuid);
    if (payload) {
      const qm = payload.quality_metadata as { step_quality_score?: number; step_quality?: string } | undefined;
      expect(qm).toBeDefined();
      expect(typeof qm?.step_quality_score).toBe('number');
      expect(typeof qm?.step_quality).toBe('string');
      expect(['excellent', 'high', 'standard', 'basic']).toContain(qm?.step_quality);
    }
  });

  test('completed (last step): next_action says kairos_attest, no final_challenge', async () => {
    const ts = Date.now();
    const items = await mintThreeStepProtocol(`V2Next Completed ${ts}`);
    const firstUri = items[0].uri;

    // Walk through all steps
    const beginPayload = await beginProtocol(firstUri);
    let nonce = beginPayload.challenge?.nonce;
    let proofHash = beginPayload.challenge?.proof_hash || beginPayload.challenge?.genesis_hash;

    // Step 1 -> 2
    const step2Result = await mcpConnection.client.callTool({
      name: 'kairos_next',
      arguments: {
        uri: items[1].uri,
        solution: { type: 'shell', nonce, proof_hash: proofHash, shell: { exit_code: 0, stdout: 'step1' } }
      }
    });
    const step2 = parseMcpJson(step2Result, 'v2-next step2');
    nonce = step2.challenge?.nonce;
    proofHash = step2.proof_hash || step2.last_proof_hash || proofHash;

    // Step 2 -> 3 (final)
    const call = {
      name: 'kairos_next',
      arguments: {
        uri: items[2].uri,
        solution: { type: 'shell', nonce, proof_hash: proofHash, shell: { exit_code: 0, stdout: 'step2' } }
      }
    };
    const result = await mcpConnection.client.callTool(call);
    const parsed = parseMcpJson(result, 'v2-next completed');

    withRawOnFail({ call, result }, () => {
      expect(parsed.must_obey).toBe(true);

      // next_action says call kairos_attest with URI
      expect(parsed.next_action).toContain('kairos_attest');
      expect(parsed.next_action).toContain('kairos://mem/');

      // No final_challenge (removed in v2)
      expect(parsed.final_challenge).toBeUndefined();
      expect(parsed.attest_required).toBeUndefined();
      expect(parsed.protocol_status).toBeUndefined();
    });
  });

  // Error response shape (error_code, retry_count) is covered by HTTP API test
  // "handles valid uri with missing solution" in http-api-endpoints.test.ts
  test.skip('error response: must_obey true on first retry, next_action with recovery, error_code present', async () => {
    // MCP validation error path: wrong nonce/proof_hash triggers error_code+retry_count.
    // Skipped: URI/solution convention makes it hard to trigger via MCP; HTTP API test covers the shape.
    const ts = Date.now();
    const items = await mintThreeStepProtocol(`V2Next Error ${ts}`);
    const firstUri = items[0].uri;
    const secondUri = items[1].uri;
    const beginPayload = await beginProtocol(firstUri);
    const nonce = beginPayload.challenge?.nonce;
    const proofHash = beginPayload.challenge?.proof_hash || beginPayload.challenge?.genesis_hash;
    await mcpConnection.client.callTool({
      name: 'kairos_next',
      arguments: {
        uri: firstUri,
        solution: {
          type: 'shell',
          nonce,
          proof_hash: proofHash,
          shell: { exit_code: 0, stdout: 'step1', stderr: '', duration_seconds: 0.1 }
        }
      }
    });
    const call = {
      name: 'kairos_next',
      arguments: {
        uri: secondUri,
        solution: {
          type: 'shell',
          nonce: 'deliberately-wrong-nonce',
          proof_hash: 'deliberately-wrong-hash',
          shell: { exit_code: 0 }
        }
      }
    };
    const result = await mcpConnection.client.callTool(call);
    const parsed = parseMcpJson(result, 'v2-next error');
    withRawOnFail({ call, result }, () => {
      expect(parsed.must_obey).toBe(true);
      expect(typeof parsed.next_action).toBe('string');
      expect(parsed.next_action).toContain('kairos://mem/');
      expect(typeof parsed.error_code).toBe('string');
      expect(typeof parsed.retry_count).toBe('number');
      expect(parsed.challenge).toBeDefined();
      expect(parsed.current_step).toBeDefined();
      expect(parsed.protocol_status).toBeUndefined();
    });
  });
});
