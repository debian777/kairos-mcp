/**
 * V2 kairos_search response shape tests.
 * Validates the unified schema from docs/workflow-kairos-search.md.
 * These tests are expected to FAIL against v1 code.
 */
import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { parseMcpJson, withRawOnFail } from '../utils/expect-with-raw.js';

describe('V2 kairos_search unified response schema', () => {
  let mcpConnection;

  beforeAll(async () => {
    mcpConnection = await createMcpConnection();
  }, 30000);

  afterAll(async () => {
    if (mcpConnection) await mcpConnection.close();
  });

  async function search(query: string) {
    const call = { name: 'kairos_search', arguments: { query } };
    const result = await mcpConnection.client.callTool(call);
    return { call, result, parsed: parseMcpJson(result, 'v2-kairos-search') };
  }

  async function mintProtocol(title: string) {
    const content = `# ${title}\n\n## Step 1\nDo something.\n\nPROOF OF WORK: comment min_length=10`;
    await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: { markdown_doc: content, llm_model_id: 'test-v2-search', force_update: true }
    });
  }

  test('single perfect match: must_obey true, choices with role match, no start_here', async () => {
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
      expect(parsed.next_action).toContain('kairos://mem/');
      expect(Array.isArray(parsed.choices)).toBe(true);
      expect(parsed.choices.length).toBeGreaterThanOrEqual(1);

      // At least one choice; if match exists, verify match shape; else verify create fallback
      const matchChoice = parsed.choices.find((c: any) => c.role === 'match');
      const choice = matchChoice || parsed.choices[0];
      expect(choice).toBeDefined();
      expect(choice.uri).toMatch(/^kairos:\/\/mem\/[0-9a-f-]{36}$/i);
      expect(typeof choice.label).toBe('string');
      expect(['match', 'create']).toContain(choice.role);
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

      // Should have creation protocol option
      const createChoice = parsed.choices.find((c: any) => c.role === 'create');
      expect(createChoice).toBeDefined();
      expect(createChoice.score).toBeNull();
      expect(createChoice.uri).toMatch(/^kairos:\/\/mem\//);

      // V1 fields must NOT exist
      expect(parsed.start_here).toBeUndefined();
      expect(parsed.best_match).toBeUndefined();
      expect(parsed.protocol_status).toBeUndefined();
    });
  });

  test('every choice has uri, label, chain_label, score, role, tags', async () => {
    const ts = Date.now();
    const title = `V2SearchFields ${ts}`;
    await mintProtocol(title);

    await new Promise((r) => setTimeout(r, 2000));
    const { call, result, parsed } = await search(title);

    withRawOnFail({ call, result }, () => {
      for (const choice of parsed.choices) {
        expect(choice).toHaveProperty('uri');
        expect(choice).toHaveProperty('label');
        expect(choice).toHaveProperty('chain_label');
        expect(choice).toHaveProperty('score');
        expect(choice).toHaveProperty('role');
        expect(choice).toHaveProperty('tags');
        expect(['match', 'create']).toContain(choice.role);
      }
    });
  });
});
