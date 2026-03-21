/**
 * Integration tests for export (MCP tool; markdown aggregate via current export).
 */

import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { parseMcpJson } from '../utils/expect-with-raw.js';

describe('Kairos export (MCP)', () => {
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
    return parseMcpJson(result, 'export raw MCP result');
  }

  test('export returns markdown content for valid layer URI', async () => {
    const ts = Date.now().toString();
    const md = `# Export Single ${ts}

## Natural Language Triggers
Run when user says "export single".

## Step A
Body for export single.

\`\`\`json
{"challenge":{"type":"shell","shell":{"cmd":"echo ok","timeout_seconds":5},"required":true}}
\`\`\`

## Completion Rule
Only after all steps.`;
    const trainResult = await mcpConnection.client.callTool({
      name: 'train',
      arguments: {
        markdown_doc: md,
        llm_model_id: 'test',
        force_update: true
      }
    });
    const trainParsed = parseMcpJson(trainResult, 'train');
    expect(trainParsed.status).toBe('stored');
    expect(Array.isArray(trainParsed.items)).toBe(true);
    expect(trainParsed.items!.length).toBeGreaterThanOrEqual(1);
    const uri = trainParsed.items![0].uri as string;
    expect(uri).toMatch(/^kairos:\/\/layer\//);

    const exportResult = await mcpConnection.client.callTool({
      name: 'export',
      arguments: { uri, format: 'markdown' }
    });
    if (exportResult.isError === true && exportResult.content?.[0]) {
      const errText = (exportResult.content[0] as { text?: string }).text ?? String(exportResult.content[0]);
      throw new Error(`export failed: ${errText}`);
    }
    expect(exportResult.isError).not.toBe(true);
    const out = expectValidJsonResult(exportResult);
    expect(out).toHaveProperty('content');
    expect(typeof out.content).toBe('string');
    expect((out.content as string).length).toBeGreaterThan(0);
    expect(out).toHaveProperty('uri', uri);
    expect(out).toHaveProperty('format', 'markdown');
    expect(out).toHaveProperty('content_type');
    expect((out.content as string).toLowerCase()).toContain('body for export single');
  }, 25000);

  test('export with adapter URI returns full adapter markdown', async () => {
    const ts = Date.now().toString();
    const md = `# Export Protocol ${ts}

## Natural Language Triggers
Run when user says "export protocol".

## First
First step.

\`\`\`json
{"challenge":{"type":"shell","shell":{"cmd":"echo one","timeout_seconds":5},"required":true}}
\`\`\`

## Second
Second step.

\`\`\`json
{"challenge":{"type":"shell","shell":{"cmd":"echo two","timeout_seconds":5},"required":true}}
\`\`\`

## Completion Rule
Only after all steps.`;
    const trainResult = await mcpConnection.client.callTool({
      name: 'train',
      arguments: {
        markdown_doc: md,
        llm_model_id: 'test',
        force_update: true
      }
    });
    const trainParsed = parseMcpJson(trainResult, 'train');
    expect(trainParsed.status).toBe('stored');
    const adapterUri = (trainParsed.items![0] as { adapter_uri: string }).adapter_uri;

    const exportResult = await mcpConnection.client.callTool({
      name: 'export',
      arguments: { uri: adapterUri, format: 'markdown' }
    });
    if (exportResult.isError === true && exportResult.content?.[0]) {
      const errText = (exportResult.content[0] as { text?: string }).text ?? String(exportResult.content[0]);
      throw new Error(`export failed: ${errText}`);
    }
    expect(exportResult.isError).not.toBe(true);
    const out = expectValidJsonResult(exportResult);
    expect(out).toHaveProperty('content');
    expect(typeof out.content).toBe('string');
    const content = out.content as string;
    expect(content).toContain('Export Protocol');
    expect(content).toContain('First');
    expect(content).toContain('Second');
  }, 25000);

  test('export with non-existent URI returns error', async () => {
    const result = await mcpConnection.client.callTool({
      name: 'export',
      arguments: { uri: 'kairos://layer/00000000-0000-0000-0000-000000000099', format: 'markdown' }
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
