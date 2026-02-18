/**
 * Integration tests for kairos_dump (MCP tool).
 * Verifies dump returns markdown_doc for a memory URI and for full protocol.
 */

import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { parseMcpJson } from '../utils/expect-with-raw.js';

describe('Kairos Dump (MCP)', () => {
  let mcpConnection: Awaited<ReturnType<typeof createMcpConnection>>;

  beforeAll(async () => {
    mcpConnection = await createMcpConnection();
  });

  afterAll(async () => {
    if (mcpConnection) {
      await mcpConnection.close();
    }
  });

  function expectValidJsonResult(result: { content?: Array<{ text?: string }>; isError?: boolean }) {
    return parseMcpJson(result, 'kairos_dump raw MCP result');
  }

  test('kairos_dump returns single-step content for valid URI', async () => {
    const ts = Date.now().toString();
    const md = `# Dump Single ${ts}\n\n## Step A\nBody for dump single.\n\nPROOF OF WORK: timeout 5s echo ok`;
    const mintResult = await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: {
        markdown_doc: JSON.stringify(md),
        llm_model_id: 'test',
        force_update: true
      }
    });
    const mintParsed = parseMcpJson(mintResult, 'kairos_mint');
    expect(mintParsed.status).toBe('stored');
    expect(Array.isArray(mintParsed.items)).toBe(true);
    expect(mintParsed.items!.length).toBeGreaterThanOrEqual(1);
    const uri = mintParsed.items![0].uri as string;
    expect(uri).toMatch(/^kairos:\/\/mem\//);

    const dumpResult = await mcpConnection.client.callTool({
      name: 'kairos_dump',
      arguments: { uri }
    });
    if (dumpResult.isError === true && dumpResult.content?.[0]) {
      const errText = (dumpResult.content[0] as { text?: string }).text ?? String(dumpResult.content[0]);
      throw new Error(`kairos_dump failed: ${errText}`);
    }
    expect(dumpResult.isError).not.toBe(true);
    const dump = expectValidJsonResult(dumpResult);
    expect(dump).toHaveProperty('markdown_doc');
    expect(typeof dump.markdown_doc).toBe('string');
    expect(dump.markdown_doc.length).toBeGreaterThan(0);
    expect(dump).toHaveProperty('uri', uri);
    expect(dump).toHaveProperty('label');
    expect(typeof dump.label).toBe('string');
    expect(dump).toHaveProperty('chain_label');
    expect(dump.markdown_doc).toContain('Body for dump single');
  }, 25000);

  test('kairos_dump with protocol: true returns full chain markdown', async () => {
    const ts = Date.now().toString();
    const md = `# Dump Protocol ${ts}\n\n## First\nFirst step.\n\nPROOF OF WORK: timeout 5s echo one\n\n## Second\nSecond step.\n\nPROOF OF WORK: timeout 5s echo two`;
    const mintResult = await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: {
        markdown_doc: JSON.stringify(md),
        llm_model_id: 'test',
        force_update: true
      }
    });
    const mintParsed = parseMcpJson(mintResult, 'kairos_mint');
    expect(mintParsed.status).toBe('stored');
    const uri = mintParsed.items![0].uri as string;

    const dumpResult = await mcpConnection.client.callTool({
      name: 'kairos_dump',
      arguments: { uri, protocol: true }
    });
    if (dumpResult.isError === true && dumpResult.content?.[0]) {
      const errText = (dumpResult.content[0] as { text?: string }).text ?? String(dumpResult.content[0]);
      throw new Error(`kairos_dump failed: ${errText}`);
    }
    expect(dumpResult.isError).not.toBe(true);
    const dump = expectValidJsonResult(dumpResult);
    expect(dump).toHaveProperty('markdown_doc');
    expect(typeof dump.markdown_doc).toBe('string');
    expect(dump).toHaveProperty('step_count');
    expect(typeof dump.step_count).toBe('number');
    expect(dump.step_count).toBeGreaterThanOrEqual(2);
    expect(dump.markdown_doc).toContain('Dump Protocol');
    expect(dump.markdown_doc).toContain('First');
    expect(dump.markdown_doc).toContain('Second');
    expect(dump).toHaveProperty('uri');
    expect((dump.uri as string).startsWith('kairos://mem/')).toBe(true);
  }, 25000);

  test('kairos_dump with non-existent URI returns error', async () => {
    const result = await mcpConnection.client.callTool({
      name: 'kairos_dump',
      arguments: { uri: 'kairos://mem/00000000-0000-0000-0000-000000000099' }
    });
    expect(result.isError).toBe(true);
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content!.length).toBeGreaterThan(0);
    const first = result.content![0] as { type?: string; text?: string };
    expect(first).toHaveProperty('text');
    const text = typeof first.text === 'string' ? first.text : '';
    expect(text.length).toBeGreaterThan(0);
    expect(text.toLowerCase()).toMatch(/memory|not found|error/i);
  }, 15000);
});
