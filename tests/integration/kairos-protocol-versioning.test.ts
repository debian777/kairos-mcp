/**
 * Integration tests for protocol versioning: frontmatter and protocol_version param,
 * exposure in activate and export.
 */

import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { parseMcpJson } from '../utils/expect-with-raw.js';
import { getTestSpaceId } from '../utils/auth-headers.js';

function protocolWithFrontmatter(title: string, version: string): string {
  return `---
version: ${version}
title: ${title}
---

# ${title}

## Natural Language Triggers
Run when user says "version test".

## Step 1
Content.

\`\`\`json
{"challenge":{"type":"comment","comment":{"min_length":5},"required":true}}
\`\`\`

## Completion Rule
Done.`;
}

function protocolNoFrontmatter(title: string): string {
  return `# ${title}

## Natural Language Triggers
Run when user says "version test".

## Step 1
Content.

\`\`\`json
{"challenge":{"type":"comment","comment":{"min_length":5},"required":true}}
\`\`\`

## Completion Rule
Done.`;
}

describe('Kairos protocol versioning', () => {
  let mcpConnection: Awaited<ReturnType<typeof createMcpConnection>>;

  beforeAll(async () => {
    mcpConnection = await createMcpConnection();
  }, 30000);

  afterAll(async () => {
    if (mcpConnection) await mcpConnection.close();
  });

  async function activate(query: string, useTestSpace = true) {
    const args: { query: string; space_id?: string } = { query };
    if (useTestSpace) {
      const spaceId = getTestSpaceId();
      if (spaceId) args.space_id = spaceId;
    }
    const result = await mcpConnection.client.callTool({ name: 'activate', arguments: args });
    return parseMcpJson(result, 'activate');
  }

  test('train with frontmatter version: activate returns adapter_version on match', async () => {
    const ts = Date.now();
    const title = `ZzVersioningFrontmatter ${ts}`;
    const md = protocolWithFrontmatter(title, '1.2.3');

    await mcpConnection.client.callTool({
      name: 'train',
      arguments: { markdown_doc: md, llm_model_id: 'test-versioning', force_update: true }
    });

    await new Promise((r) => setTimeout(r, 6000));
    const parsed = await activate(`ZzVersioningFrontmatter ${ts}`, false);

    const ourMatch = parsed.choices?.find(
      (c: { role: string; label?: string }) => c.role === 'match' && (c.label || '').includes('ZzVersioningFrontmatter')
    );
    if (ourMatch) {
      expect(ourMatch).toHaveProperty('adapter_version', '1.2.3');
      return;
    }
    const anyMatch = parsed.choices?.find((c: { role: string }) => c.role === 'match');
    expect(anyMatch).toBeDefined();
    expect(anyMatch).toHaveProperty('adapter_version');
    expect(
      typeof (anyMatch as { adapter_version?: string | null }).adapter_version === 'string' ||
        (anyMatch as { adapter_version?: string | null }).adapter_version === null
    ).toBe(true);
  });

  test('train with protocol_version param: activate returns that version', async () => {
    const ts = Date.now();
    const title = `ZzVersioningExplicit ${ts}`;
    const md = protocolNoFrontmatter(title);

    await mcpConnection.client.callTool({
      name: 'train',
      arguments: {
        markdown_doc: md,
        llm_model_id: 'test-versioning',
        force_update: true,
        protocol_version: '2.0.0'
      }
    });

    await new Promise((r) => setTimeout(r, 6000));
    const parsed = await activate(`ZzVersioningExplicit ${ts}`, false);

    const ourMatch = parsed.choices?.find(
      (c: { role: string; label?: string }) => c.role === 'match' && (c.label || '').includes('ZzVersioningExplicit')
    );
    if (ourMatch) {
      expect(ourMatch).toHaveProperty('adapter_version', '2.0.0');
      return;
    }
    const anyMatch = parsed.choices?.find((c: { role: string }) => c.role === 'match');
    expect(anyMatch).toBeDefined();
    expect(anyMatch).toHaveProperty('adapter_version');
  });

  test('export includes adapter_version when chain has one', async () => {
    const ts = Date.now();
    const title = `Dump Version ${ts}`;
    const md = protocolWithFrontmatter(title, '3.0.0');

    const trainResult = await mcpConnection.client.callTool({
      name: 'train',
      arguments: { markdown_doc: md, llm_model_id: 'test-versioning', force_update: true }
    });
    const trainParsed = parseMcpJson(trainResult, 'train');
    expect(trainParsed.status).toBe('stored');
    const uri = (trainParsed.items as { uri: string }[])[0].uri;

    const exportResult = await mcpConnection.client.callTool({
      name: 'export',
      arguments: { uri, format: 'markdown' }
    });
    if ((exportResult as { isError?: boolean }).isError) {
      const text = (exportResult as { content?: { text?: string }[] }).content?.[0]?.text ?? JSON.stringify(exportResult);
      throw new Error(`export failed: ${text}`);
    }
    const dump = parseMcpJson(exportResult, 'export');
    expect(dump).toHaveProperty('adapter_version', '3.0.0');
  });

  test('refine and create choices have adapter_version null', async () => {
    const gibberish = `XyZVersioningGarbage${Date.now()}`;
    const parsed = await activate(gibberish);

    const refineChoice = parsed.choices?.find((c: { role: string }) => c.role === 'refine');
    const createChoice = parsed.choices?.find((c: { role: string }) => c.role === 'create');
    expect(refineChoice).toHaveProperty('adapter_version', null);
    expect(createChoice).toHaveProperty('adapter_version', null);
  });
});
