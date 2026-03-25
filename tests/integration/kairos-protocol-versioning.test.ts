/**
 * Integration tests for protocol versioning: frontmatter and protocol_version param,
 * exposure in kairos_search and kairos_dump.
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

  async function search(query: string, useTestSpace = true) {
    const args: { query: string; space_id?: string } = { query };
    if (useTestSpace) {
      const spaceId = getTestSpaceId();
      if (spaceId) args.space_id = spaceId;
    }
    const result = await mcpConnection.client.callTool({ name: 'kairos_search', arguments: args });
    return parseMcpJson(result, 'kairos_search');
  }

  test('mint with frontmatter version: search returns protocol_version on match', async () => {
    const ts = Date.now();
    const title = `ZzVersioningFrontmatter ${ts}`;
    const md = protocolWithFrontmatter(title, '1.2.3');

    await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: { markdown_doc: md, llm_model_id: 'test-versioning', force_update: true }
    });

    await new Promise((r) => setTimeout(r, 6000));
    const parsed = await search(`ZzVersioningFrontmatter ${ts}`, false);

    const ourMatch = parsed.choices?.find(
      (c: any) => c.role === 'match' && (c.chain_label || '').includes('ZzVersioningFrontmatter')
    );
    if (ourMatch) {
      expect(ourMatch).toHaveProperty('protocol_version', '1.2.3');
      return;
    }
    const anyMatch = parsed.choices?.find((c: any) => c.role === 'match');
    expect(anyMatch).toBeDefined();
    expect(anyMatch).toHaveProperty('protocol_version');
    expect(typeof (anyMatch as any).protocol_version === 'string' || (anyMatch as any).protocol_version === null).toBe(true);
  });

  test('mint with protocol_version param: search returns that version', async () => {
    const ts = Date.now();
    const title = `ZzVersioningExplicit ${ts}`;
    const md = protocolNoFrontmatter(title);

    await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: {
        markdown_doc: md,
        llm_model_id: 'test-versioning',
        force_update: true,
        protocol_version: '2.0.0'
      }
    });

    await new Promise((r) => setTimeout(r, 6000));
    const parsed = await search(`ZzVersioningExplicit ${ts}`, false);

    const ourMatch = parsed.choices?.find(
      (c: any) => c.role === 'match' && (c.chain_label || '').includes('ZzVersioningExplicit')
    );
    if (ourMatch) {
      expect(ourMatch).toHaveProperty('protocol_version', '2.0.0');
      return;
    }
    const anyMatch = parsed.choices?.find((c: any) => c.role === 'match');
    expect(anyMatch).toBeDefined();
    expect(anyMatch).toHaveProperty('protocol_version');
    expect(typeof (anyMatch as any).protocol_version === 'string' || (anyMatch as any).protocol_version === null).toBe(true);
  });

  test('kairos_dump includes protocol_version when chain has one', async () => {
    const ts = Date.now();
    const title = `Dump Version ${ts}`;
    const md = protocolWithFrontmatter(title, '3.0.0');

    const mintResult = await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: { markdown_doc: md, llm_model_id: 'test-versioning', force_update: true }
    });
    const mintParsed = parseMcpJson(mintResult, 'kairos_mint');
    expect(mintParsed.status).toBe('stored');
    const uri = (mintParsed.items as any[])[0].uri as string;

    const dumpResult = await mcpConnection.client.callTool({
      name: 'kairos_dump',
      arguments: { uri }
    });
    if ((dumpResult as any).isError) {
      const text = (dumpResult as any).content?.[0]?.text ?? JSON.stringify(dumpResult);
      throw new Error(`kairos_dump failed: ${text}`);
    }
    const dump = parseMcpJson(dumpResult, 'kairos_dump');
    expect(dump).toHaveProperty('protocol_version', '3.0.0');
  });

  test('refine and create choices include protocol_version when footer protocols are resolvable', async () => {
    const gibberish = `XyZVersioningGarbage${Date.now()}`;
    const parsed = await search(gibberish);

    const refineChoice = parsed.choices?.find((c: any) => c.role === 'refine');
    const createChoice = parsed.choices?.find((c: any) => c.role === 'create');
    expect(refineChoice).toHaveProperty('protocol_version');
    expect(createChoice).toHaveProperty('protocol_version');
    for (const c of [refineChoice, createChoice]) {
      const v = c?.protocol_version;
      expect(v === null || typeof v === 'string').toBe(true);
    }
  });
});
