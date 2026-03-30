/**
 * Activate tool response shape tests.
 * Tests use the actual space of kairos-tester (user:realm:sub from token); activate passes space_id
 * so train and activate run in the same scope and adapters stored via train are visible.
 *
 * Depends on: train (and optionally tune). Run train integration tests first where sequenced.
 */
import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { parseMcpJson, withRawOnFail } from '../utils/expect-with-raw.js';
import { getTestSpaceId } from '../utils/auth-headers.js';

describe('v4-activate unified response schema', () => {
  let mcpConnection;

  function expectConfidenceMessageWithinBounds(message: string) {
    const match = message.match(/top confidence: (\d+)%/i);
    if (!match) return;
    expect(Number(match[1])).toBeLessThanOrEqual(100);
  }

  beforeAll(async () => {
    mcpConnection = await createMcpConnection();
  }, 30000);

  afterAll(async () => {
    if (mcpConnection) await mcpConnection.close();
  });

  async function activateQuery(query: string) {
    const args: { query: string; space_id?: string } = { query };
    const spaceId = getTestSpaceId();
    if (spaceId) args.space_id = spaceId;
    const call = { name: 'activate', arguments: args };
    const result = await mcpConnection.client.callTool(call);
    return { call, result, parsed: parseMcpJson(result, 'v4-activate') };
  }

  async function trainProtocol(title: string) {
    const content = `# ${title}\n\n## Natural Language Triggers\nWhen.\n\n## Step 1\nDo something.\n\n\`\`\`json\n{"contract":{"type":"comment","comment":{"min_length":10},"required":true}}\n\`\`\`\n\n## Completion Rule\nDone.`;
    await mcpConnection.client.callTool({
      name: 'train',
      arguments: { markdown_doc: content, llm_model_id: 'test-v4-activate', force_update: true }
    });
  }

  test('Create New KAIROS adapter: activate returns choices', async () => {
    const ts = Date.now();
    const title = `V4ActivateSingle ${ts}`;
    await trainProtocol(title);

    // Allow Qdrant indexing to complete
    await new Promise((r) => setTimeout(r, 4000));
    const { call, result, parsed } = await activateQuery(title);

    withRawOnFail({ call, result }, () => {
      expect(parsed.must_obey).toBe(true);
      expect(typeof parsed.message).toBe('string');
      expectConfidenceMessageWithinBounds(parsed.message);
      expect(typeof parsed.next_action).toBe('string');
      expect(
        parsed.next_action.includes("choice's next_action") ||
          parsed.next_action.includes('kairos://') ||
          parsed.next_action.toLowerCase().includes('forward')
      ).toBe(true);
      expect(Array.isArray(parsed.choices)).toBe(true);
      expect(parsed.choices.length).toBeGreaterThanOrEqual(1);

      const matchChoice = parsed.choices.find((c: { role: string }) => c.role === 'match');
      const choice = matchChoice || parsed.choices[0];
      expect(choice).toBeDefined();
      expect(choice.uri).toMatch(/^kairos:\/\/adapter\/[0-9a-f-]{36}$/i);
      expect(typeof choice.label).toBe('string');
      if (parsed.next_action.includes("choice's next_action")) {
        expect(choice).toHaveProperty('next_action');
      }
      expect(['match', 'refine', 'create']).toContain(choice.role);
      if (choice.role === 'match') {
        expect(typeof choice.activation_score).toBe('number');
        expect(choice.activation_score).toBeGreaterThanOrEqual(0);
        expect(choice.activation_score).toBeLessThanOrEqual(1);
      } else {
        expect(choice.activation_score === null).toBe(true);
      }
      expect(Array.isArray(choice.tags)).toBe(true);

      expect(parsed.start_here).toBeUndefined();
      expect(parsed.best_match).toBeUndefined();
      expect(parsed.protocol_status).toBeUndefined();
      expect(parsed.suggestion).toBeUndefined();
      expect(parsed.hint).toBeUndefined();
    });
  });

  test('builtin refine/create chains are not returned as vector matches (no duplicate URIs)', async () => {
    const { call, result, parsed } = await activateQuery('protocol');
    const refineUri = 'kairos://adapter/00000000-0000-0000-0000-000000002002';
    const createUri = 'kairos://adapter/00000000-0000-0000-0000-000000002001';
    withRawOnFail({ call, result }, () => {
      const matches = parsed.choices.filter((c: { role: string }) => c.role === 'match');
      expect(matches.some((c: { uri: string }) => c.uri === refineUri)).toBe(false);
      expect(matches.some((c: { uri: string }) => c.uri === createUri)).toBe(false);
      const footerCreate = parsed.choices.filter(
        (c: { role: string; uri: string }) => c.role === 'create' && c.uri === createUri
      );
      expect(footerCreate.length).toBeLessThanOrEqual(1);
    });
  }, 45000);

  test('no matches: must_obey true, creation adapter with role create', async () => {
    const ts = Date.now();
    const gibberish = `XyZ123GarbageV4Test${ts}NoOneSearchesThis`;

    const { call, result, parsed } = await activateQuery(gibberish);

    withRawOnFail({ call, result }, () => {
      expect(parsed.must_obey).toBe(true);
      expect(typeof parsed.message).toBe('string');
      expect(typeof parsed.next_action).toBe('string');
      expect(Array.isArray(parsed.choices)).toBe(true);
      expect(parsed.choices.length).toBeGreaterThanOrEqual(1);

      const refineChoice = parsed.choices.find((c: { role: string }) => c.role === 'refine');
      const createChoice = parsed.choices.find((c: { role: string }) => c.role === 'create');
      expect(createChoice).toBeDefined();
      expect(createChoice!.activation_score).toBeNull();
      expect(createChoice!.uri).toMatch(/^kairos:\/\/adapter\/[0-9a-f-]{36}$/i);
      expect(refineChoice).toBeDefined();
      expect(refineChoice!.uri).toBe('kairos://adapter/00000000-0000-0000-0000-000000002002');
      expect(typeof refineChoice!.next_action).toBe('string');
      expect(refineChoice!.next_action).toContain('forward');
      expect(refineChoice!.next_action).toContain('00000000-0000-0000-0000-000000002002');
      expect(refineChoice!.label).toBe('Get help refining your search');
      if (createChoice!.next_action !== undefined) {
        expect(typeof createChoice!.next_action).toBe('string');
      }

      expect(parsed.start_here).toBeUndefined();
      expect(parsed.best_match).toBeUndefined();
      expect(parsed.protocol_status).toBeUndefined();
    });
  });

  test('authoring wording: register personal adapter keeps create choice visible', async () => {
    const { call, result, parsed } = await activateQuery('Register personal KAIROS adapter');
    const createUri = 'kairos://adapter/00000000-0000-0000-0000-000000002001';

    withRawOnFail({ call, result }, () => {
      const createChoice = parsed.choices.find(
        (c: { role: string; uri: string }) => c.role === 'create' && c.uri === createUri
      );
      expect(createChoice).toBeDefined();
      expect(String(createChoice!.label).toLowerCase()).toContain('adapter');
      expect(String(createChoice!.label).toLowerCase()).toContain('protocol');
      expect(String(createChoice!.next_action).toLowerCase()).toContain('register');
      expect(String(createChoice!.next_action).toLowerCase()).toContain('adapter/protocol/workflow');
    });
  });

  test('multiple matches: refine and create choices have correct URI and next_action', async () => {
    const ts = Date.now();
    const token = `V4ActivateMulti${ts}`;
    await trainProtocol(`${token} Alpha`);
    await trainProtocol(`${token} Beta`);
    let parsed: ReturnType<typeof parseMcpJson>;
    let call: { name: string; arguments: Record<string, unknown> };
    let result: unknown;
    for (let attempt = 0; attempt < 5; attempt++) {
      await new Promise((r) => setTimeout(r, attempt === 0 ? 6000 : 3000));
      const out = await activateQuery(token);
      parsed = out.parsed;
      call = out.call;
      result = out.result;
      const matches = parsed.choices.filter((c: { role: string }) => c.role === 'match');
      if (matches.length >= 2) break;
    }

    withRawOnFail({ call, result }, () => {
      expect(parsed.must_obey).toBe(true);
      expect(Array.isArray(parsed.choices)).toBe(true);
      expectConfidenceMessageWithinBounds(parsed.message);
      const matches = parsed.choices.filter((c: { role: string }) => c.role === 'match');
      expect(matches.length).toBeGreaterThanOrEqual(2);
      for (const match of matches) {
        expect(match.activation_score).toBeGreaterThanOrEqual(0);
        expect(match.activation_score).toBeLessThanOrEqual(1);
      }

      const refineChoice = parsed.choices.find((c: { role: string }) => c.role === 'refine');
      const createChoice = parsed.choices.find((c: { role: string }) => c.role === 'create');
      expect(refineChoice).toBeDefined();
      expect(createChoice).toBeDefined();
      expect(refineChoice!.uri).toBe('kairos://adapter/00000000-0000-0000-0000-000000002002');
      expect(refineChoice!.next_action).toContain('forward');
      expect(refineChoice!.next_action).toContain('00000000-0000-0000-0000-000000002002');
      expect(createChoice!.uri).toBe('kairos://adapter/00000000-0000-0000-0000-000000002001');
      expect(createChoice!.next_action).toContain('train');
    });
  }, 60000);

  test('every choice has uri, label, adapter_name, activation_score, role, tags', async () => {
    const ts = Date.now();
    const title = `V4ActivateFields ${ts}`;
    await trainProtocol(title);

    await new Promise((r) => setTimeout(r, 2000));
    const { call, result, parsed } = await activateQuery(title);

    withRawOnFail({ call, result }, () => {
      const isNewFormat =
        typeof parsed.next_action === 'string' && parsed.next_action.includes("choice's next_action");
      for (const choice of parsed.choices) {
        expect(choice).toHaveProperty('uri');
        expect(choice).toHaveProperty('label');
        expect(choice).toHaveProperty('adapter_name');
        expect(choice).toHaveProperty('activation_score');
        expect(choice).toHaveProperty('role');
        expect(choice).toHaveProperty('tags');
        if (isNewFormat) expect(choice).toHaveProperty('next_action');
        expect(['match', 'refine', 'create']).toContain(choice.role);
        if (choice.role === 'match') {
          expect(choice.activation_score).toBeGreaterThanOrEqual(0);
          expect(choice.activation_score).toBeLessThanOrEqual(1);
        }
      }
    });
  }, 45000);
});
