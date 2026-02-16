import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { parseMcpJson, withRawOnFail } from '../utils/expect-with-raw.js';

/**
 * FORBIDDEN BEHAVIOUR tests
 * 
 * Tests that kairos_search never violates the forbidden behaviors from reports/outputs.md:
 * - Do not return `error` field
 * - Do not return raw `score` (0.73) to user
 * - Do not return `results[]` when must_obey: true
 * - Do not pick silently when multiple perfect matches exist
 * - Do not say "I can't" — always offer creation
 */

describe('Kairos Search - FORBIDDEN BEHAVIOUR', () => {
  let mcpConnection;

  beforeAll(async () => {
    mcpConnection = await createMcpConnection();
  });

  afterAll(async () => {
    if (mcpConnection) {
      await mcpConnection.close();
    }
  });

  function expectValidJsonResult(result) {
    return parseMcpJson(result, 'kairos_search raw MCP result');
  }

  test('never returns error field', async () => {
    const ts = Date.now();
    const call = {
      name: 'kairos_search',
      arguments: {
        query: `NoErrorFieldTest ${ts}`
      }
    };
    const result = await mcpConnection.client.callTool(call);

    withRawOnFail({ call, result }, () => {
      const parsed = expectValidJsonResult(result);
      // Should never have an 'error' field
      expect(parsed.error).toBeUndefined();
    }, 'no error field test');
  }, 20000);

  test('never returns raw score to user', async () => {
    const ts = Date.now();
    const uniqueTitle = `NoRawScoreTest ${ts}`;
    const content = `# ${uniqueTitle}\n\nTest for raw score exposure.`;

    // Store
    await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: {
        markdown_doc: content,
        llm_model_id: 'minimax/minimax-m2:free',
        force_update: true
      }
    });

    // Search
    const call = {
      name: 'kairos_search',
      arguments: {
        query: uniqueTitle.toLowerCase()
      }
    };
    const result = await mcpConnection.client.callTool(call);

    withRawOnFail({ call, result }, () => {
      const parsed = expectValidJsonResult(result);
      // Score should never appear as top-level field
      expect(parsed.score).toBeUndefined();
      // V2: score is only inside choices[].score, never at top level
      if (Array.isArray(parsed.choices)) {
        for (const choice of parsed.choices) {
          if (choice.role === 'match') {
            expect(typeof choice.score).toBe('number');
          }
        }
      }
      // V1 best_match must NOT exist
      expect(parsed.best_match).toBeUndefined();
    }, 'no raw score test');
  }, 20000);

  test('never returns results[] array when must_obey: true', async () => {
    const ts = Date.now();
    const uniqueTitle = `NoResultsArrayTest ${ts}`;
    const content = `# ${uniqueTitle}\n\nTest for results array.`;

    // Store
    await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: {
        markdown_doc: content,
        llm_model_id: 'minimax/minimax-m2:free',
        force_update: true
      }
    });

    // Search
    const call = {
      name: 'kairos_search',
      arguments: {
        query: uniqueTitle.toLowerCase()
      }
    };
    const result = await mcpConnection.client.callTool(call);

    withRawOnFail({ call, result }, () => {
      const parsed = expectValidJsonResult(result);
      // Should never have a 'results' array when must_obey: true
      if (parsed.must_obey === true) {
        expect(parsed.results).toBeUndefined();
      }
    }, 'no results array test');
  }, 20000);
});

