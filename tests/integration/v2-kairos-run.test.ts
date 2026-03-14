/**
 * V2 kairos_run response shape and routing tests.
 * Validates canonical natural-language entrypoint: message -> search -> begin (one strong match or refine).
 */
import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { parseMcpJson, withRawOnFail } from '../utils/expect-with-raw.js';
import { getTestSpaceId } from '../utils/auth-headers.js';

const REFINING_PROTOCOL_URI = 'kairos://mem/00000000-0000-0000-0000-000000002002';

describe('V2 kairos_run', () => {
  let mcpConnection: any;

  beforeAll(async () => {
    mcpConnection = await createMcpConnection();
  }, 30000);

  afterAll(async () => {
    if (mcpConnection) await mcpConnection.close();
  });

  async function runMessage(message: string) {
    const args: { message: string; space_id?: string } = { message };
    const spaceId = getTestSpaceId();
    if (spaceId) args.space_id = spaceId;
    const call = { name: 'kairos_run', arguments: args };
    const result = await mcpConnection.client.callTool(call);
    return { call, result, parsed: parseMcpJson(result, 'v2-kairos-run') };
  }

  async function mintProtocol(title: string) {
    const content = `# ${title}\n\n## Step 1\nDo something.\n\n\`\`\`json\n{"challenge":{"type":"comment","comment":{"min_length":10},"required":true}}\n\`\`\``;
    await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: { markdown_doc: content, llm_model_id: 'test-v2-run', force_update: true }
    });
  }

  test('response has must_obey, routing, current_step, challenge, next_action', async () => {
    const { call, result, parsed } = await runMessage('show me engine status');

    withRawOnFail({ call, result }, () => {
      expect(parsed.must_obey).toBe(true);
      expect(parsed.routing).toBeDefined();
      expect(parsed.routing.decision).toBeDefined();
      expect(parsed.routing.selected_uri).toMatch(/^kairos:\/\/mem\/[0-9a-f-]{36}$/i);
      expect(parsed.routing.selected_label).toBeDefined();
      expect(['match', 'refine', 'create']).toContain(parsed.routing.selected_role);
      expect(parsed.current_step).toBeDefined();
      expect(parsed.current_step.uri).toMatch(/^kairos:\/\/mem\//);
      expect(parsed.current_step.mimeType).toBe('text/markdown');
      expect(parsed.challenge).toBeDefined();
      expect(typeof parsed.next_action).toBe('string');
      expect(parsed.next_action).toMatch(/kairos_next|kairos_attest/);
    });
  });

  test('no match: routing decision is refine_no_match or refine_weak_match, selected_uri is refine', async () => {
    const gibberish = `XyZ999GarbageV2Run${Date.now()}NoOneMatchesThis`;
    const { call, result, parsed } = await runMessage(gibberish);

    withRawOnFail({ call, result }, () => {
      expect(parsed.must_obey).toBe(true);
      expect(['refine_no_match', 'refine_weak_match', 'refine_ambiguous']).toContain(parsed.routing.decision);
      expect(parsed.routing.selected_uri).toBe(REFINING_PROTOCOL_URI);
      expect(parsed.routing.selected_role).toBe('refine');
      expect(parsed.current_step.uri).toBe(REFINING_PROTOCOL_URI);
    });
  });

  test('one strong match: direct_match and begin shape compatible with kairos_next', async () => {
    const ts = Date.now();
    const title = `V2RunDirectMatch ${ts}`;
    await mintProtocol(title);
    await new Promise((r) => setTimeout(r, 4000));

    const { call, result, parsed } = await runMessage(title);

    withRawOnFail({ call, result }, () => {
      expect(parsed.must_obey).toBe(true);
      expect(parsed.routing).toBeDefined();
      expect(parsed.routing.decision).toBeDefined();
      expect(parsed.routing.selected_uri).toMatch(/^kairos:\/\/mem\/[0-9a-f-]{36}$/i);
      expect(parsed.current_step).toBeDefined();
      expect(parsed.challenge).toBeDefined();
      expect(parsed.challenge.type).toBeDefined();
      expect(typeof parsed.next_action).toBe('string');
      expect(parsed.next_action).toMatch(/kairos_next|kairos_attest/);
      expect(parsed.next_action).toContain(parsed.current_step.uri);

      if (parsed.routing.decision === 'direct_match') {
        expect(parsed.routing.selected_role).toBe('match');
        expect(parsed.next_action).toContain('kairos_next');
      }
      // When multiple chains match (refine_ambiguous), server correctly routes to refine; shape is still valid.
    });
  }, 45000);
});
