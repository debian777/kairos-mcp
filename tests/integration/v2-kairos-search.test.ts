/**
 * V10 activate response shape tests (formerly kairos_search).
 * Tests use the actual space of kairos-tester (user:realm:sub from token); activate passes space_id
 * so train and activate run in the same scope and adapters minted are visible.
 *
 * Depends on: train (and optionally tune). Run train integration tests first where sequenced.
 */
import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { parseMcpJson, withRawOnFail } from '../utils/expect-with-raw.js';
import { getTestSpaceId } from '../utils/auth-headers.js';

describe('V10 activate unified response schema', () => {
  let mcpConnection;

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
    return { call, result, parsed: parseMcpJson(result, 'v10-activate') };
  }

  async function trainProtocol(title: string) {
    const content = `# ${title}\n\n## Natural Language Triggers\nWhen.\n\n## Step 1\nDo something.\n\n\`\`\`json\n{"challenge":{"type":"comment","comment":{"min_length":10},"required":true}}\n\`\`\`\n\n## Completion Rule\nDone.`;
    await mcpConnection.client.callTool({
      name: 'train',
      arguments: { markdown_doc: content, llm_model_id: 'test-v2-search', force_update: true }
    });
  }

  test('Create New KAIROS adapter: activate returns choices', async () => {
    const ts = Date.now();
    const title = `V2SearchSingle ${ts}`;
    await trainProtocol(title);

    // Allow Qdrant indexing to complete
    await new Promise((r) => setTimeout(r, 4000));
    const { call, result, parsed } = await activateQuery(title);

    withRawOnFail({ call, result }, () => {
      expect(parsed.must_obey).toBe(true);
      expect(typeof parsed.message).toBe('string');
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

  test('no matches: must_obey true, creation adapter with role create', async () => {
    const ts = Date.now();
    const gibberish = `XyZ123GarbageV2Test${ts}NoOneSearchesThis`;

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

  test('multiple matches: refine and create choices have correct URI and next_action', async () => {
    const ts = Date.now();
    const token = `V2RefineMulti${ts}`;
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
      const matches = parsed.choices.filter((c: { role: string }) => c.role === 'match');
      expect(matches.length).toBeGreaterThanOrEqual(2);

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
    const title = `V2SearchFields ${ts}`;
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
      }
    });
  }, 45000);
});
