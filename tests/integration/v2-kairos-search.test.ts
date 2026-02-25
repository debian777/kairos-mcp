/**
 * V2 kairos_search response shape tests.
 * Validates the unified schema from docs/workflow-kairos-search.md.
 * Tests use the actual space of kairos-tester (user:realm:sub from token); search passes space_id
 * so mint and search run in the same scope and protocols minted are visible.
 *
 * Depends on: kairos_mint and kairos_update. This file calls kairos_mint; run mint and update
 * integration tests first (jest integration sequencer enforces order).
 */
import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { parseMcpJson, withRawOnFail } from '../utils/expect-with-raw.js';
import { getTestSpaceId } from '../utils/auth-headers.js';

describe('V2 kairos_search unified response schema', () => {
  let mcpConnection;

  beforeAll(async () => {
    mcpConnection = await createMcpConnection();
  }, 30000);

  afterAll(async () => {
    if (mcpConnection) await mcpConnection.close();
  });

  async function search(query: string) {
    const args: { query: string; space_id?: string } = { query };
    const spaceId = getTestSpaceId();
    if (spaceId) args.space_id = spaceId;
    const call = { name: 'kairos_search', arguments: args };
    const result = await mcpConnection.client.callTool(call);
    return { call, result, parsed: parseMcpJson(result, 'v2-kairos-search') };
  }

  async function mintProtocol(title: string) {
    const content = `# ${title}\n\n## Step 1\nDo something.\n\n\`\`\`json\n{"challenge":{"type":"comment","comment":{"min_length":10},"required":true}}\n\`\`\``;
    await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: { markdown_doc: content, llm_model_id: 'test-v2-search', force_update: true }
    });
  }

  test('Create New KAIROS Protocol Chain', async () => {
    const ts = Date.now();
    const title = `V2SearchSingle ${ts}`;
    await mintProtocol(title);

    // Allow Qdrant indexing to complete
    await new Promise((r) => setTimeout(r, 4000));
    const { call, result, parsed } = await search(title);

    withRawOnFail({ call, result }, () => {
      // V2 unified fields
      expect(parsed.must_obey).toBe(true);
      expect(typeof parsed.message).toBe('string');
      expect(typeof parsed.next_action).toBe('string');
      expect(
        parsed.next_action.includes("choice's next_action") || parsed.next_action.includes('kairos://mem/')
      ).toBe(true);
      expect(Array.isArray(parsed.choices)).toBe(true);
      expect(parsed.choices.length).toBeGreaterThanOrEqual(1);

      // At least one choice; if match exists, verify match shape; else verify create fallback
      const matchChoice = parsed.choices.find((c: any) => c.role === 'match');
      const choice = matchChoice || parsed.choices[0];
      expect(choice).toBeDefined();
      expect(choice.uri).toMatch(/^kairos:\/\/mem\/[0-9a-f-]{36}$/i);
      expect(typeof choice.label).toBe('string');
      if (parsed.next_action.includes("choice's next_action")) {
        expect(choice).toHaveProperty('next_action');
      }
      expect(['match', 'refine', 'create']).toContain(choice.role);
      if (choice.role === 'match') {
        expect(typeof choice.score).toBe('number');
      } else {
        expect(choice.score === null).toBe(true);
      }
      expect(Array.isArray(choice.tags)).toBe(true);

      // V1 fields must NOT exist
      expect(parsed.start_here).toBeUndefined();
      expect(parsed.best_match).toBeUndefined();
      expect(parsed.protocol_status).toBeUndefined();
      expect(parsed.suggestion).toBeUndefined();
      expect(parsed.hint).toBeUndefined();
    });
  });

  test('no matches: must_obey true, creation protocol with role create', async () => {
    const ts = Date.now();
    const gibberish = `XyZ123GarbageV2Test${ts}NoOneSearchesThis`;

    const { call, result, parsed } = await search(gibberish);

    withRawOnFail({ call, result }, () => {
      expect(parsed.must_obey).toBe(true);
      expect(typeof parsed.message).toBe('string');
      expect(typeof parsed.next_action).toBe('string');
      expect(Array.isArray(parsed.choices)).toBe(true);
      expect(parsed.choices.length).toBeGreaterThanOrEqual(1);

      // Should have creation protocol; new format also has refine choice
      const refineChoice = parsed.choices.find((c: any) => c.role === 'refine');
      const createChoice = parsed.choices.find((c: any) => c.role === 'create');
      expect(createChoice).toBeDefined();
      expect(createChoice!.score).toBeNull();
      expect(createChoice!.uri).toMatch(/^kairos:\/\/mem\//);
      expect(refineChoice).toBeDefined();
      expect(refineChoice!.uri).toBe('kairos://mem/00000000-0000-0000-0000-000000002002');
      expect(typeof refineChoice!.next_action).toBe('string');
      expect(refineChoice!.next_action).toContain('kairos_begin');
      expect(refineChoice!.next_action).toContain('00000000-0000-0000-0000-000000002002');
      expect(refineChoice!.label).toBe('Get help refining your search');
      if (createChoice!.next_action !== undefined) {
        expect(typeof createChoice!.next_action).toBe('string');
      }

      // V1 fields must NOT exist
      expect(parsed.start_here).toBeUndefined();
      expect(parsed.best_match).toBeUndefined();
      expect(parsed.protocol_status).toBeUndefined();
    });
  });

  test(
    'multiple matches: refine and create choices have correct URI and next_action',
    async () => {
    const ts = Date.now();
    const token = `V2RefineMulti${ts}`;
    await mintProtocol(`${token} Alpha`);
    await mintProtocol(`${token} Beta`);
    // Allow embedding + Qdrant indexing; retry search so indexing delay doesn't flake
    let parsed: any;
    let call: any;
    let result: any;
    for (let attempt = 0; attempt < 5; attempt++) {
      await new Promise((r) => setTimeout(r, attempt === 0 ? 6000 : 3000));
      const out = await search(token);
      parsed = out.parsed;
      call = out.call;
      result = out.result;
      const matches = parsed.choices.filter((c: any) => c.role === 'match');
      if (matches.length >= 2) break;
    }

    withRawOnFail({ call, result }, () => {
      expect(parsed.must_obey).toBe(true);
      expect(Array.isArray(parsed.choices)).toBe(true);
      const matches = parsed.choices.filter((c: any) => c.role === 'match');
      expect(matches.length).toBeGreaterThanOrEqual(2);

      const refineChoice = parsed.choices.find((c: any) => c.role === 'refine');
      const createChoice = parsed.choices.find((c: any) => c.role === 'create');
      expect(refineChoice).toBeDefined();
      expect(createChoice).toBeDefined();
      expect(refineChoice!.uri).toBe('kairos://mem/00000000-0000-0000-0000-000000002002');
      expect(refineChoice!.next_action).toContain('kairos_begin');
      expect(refineChoice!.next_action).toContain('00000000-0000-0000-0000-000000002002');
      expect(createChoice!.uri).toBe('kairos://mem/00000000-0000-0000-0000-000000002001');
      expect(createChoice!.next_action).toContain('kairos_begin');
      expect(createChoice!.next_action).toContain('00000000-0000-0000-0000-000000002001');
    });
  }, 60000);

  test(
    'every choice has uri, label, chain_label, score, role, tags',
    async () => {
      const ts = Date.now();
      const title = `V2SearchFields ${ts}`;
      await mintProtocol(title);

      await new Promise((r) => setTimeout(r, 2000));
      const { call, result, parsed } = await search(title);

      withRawOnFail({ call, result }, () => {
        const isNewFormat = typeof parsed.next_action === 'string' && parsed.next_action.includes("choice's next_action");
        for (const choice of parsed.choices) {
          expect(choice).toHaveProperty('uri');
          expect(choice).toHaveProperty('label');
          expect(choice).toHaveProperty('chain_label');
          expect(choice).toHaveProperty('score');
          expect(choice).toHaveProperty('role');
          expect(choice).toHaveProperty('tags');
          if (isNewFormat) expect(choice).toHaveProperty('next_action');
          expect(['match', 'refine', 'create']).toContain(choice.role);
        }
      });
    },
    45000
  );
});
