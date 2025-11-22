import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { withRawOnFail } from '../utils/expect-with-raw.js';

function extractBody(text) {
  const start = /<!--\s*KAIROS:BODY-START\s*-->/i;
  const end = /<!--\s*KAIROS:BODY-END\s*-->/i;
  const s = text.search(start);
  const e = text.search(end);
  if (s >= 0 && e > s) {
    const m = text.match(start);
    if (!m) return text;
    const startIdx = (m.index || 0) + m[0].length;
    return text.slice(startIdx, e).trim();
  }
  return text;
}

describe('kairos://mem resource format + kairos_update end-to-end', () => {
  let mcpConnection;

  beforeAll(async () => {
    mcpConnection = await createMcpConnection();
  }, 60000);

  afterAll(async () => {
    if (mcpConnection) await mcpConnection.close();
  });

  test('format markers, then BODY update via markdown_doc, then full-render update', async () => {
    // 1) Store a simple memory (single doc is enough for format + updates)
    const ts = Date.now();
    const md = `# E2E Resource Test ${ts}

This is initial BODY.`;

    const storeResult = await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: { markdown_doc: md, llm_model_id: 'test-model-resource-update' }
    });

    const storeResp = JSON.parse(storeResult.content[0].text);
    withRawOnFail(storeResp, () => {
      expect(storeResp.status).toBe('stored');
      expect(Array.isArray(storeResp.items)).toBe(true);
      expect(storeResp.items.length).toBeGreaterThan(0);
    }, 'kairos_mint raw');

    const memUri = storeResp.items[0].uri;

    // 2) Verify kairos://mem format
    const read1 = await mcpConnection.client.readResource({ uri: memUri });
    const text1 = read1.contents?.[0]?.text || '';
    withRawOnFail(text1, () => {
      expect(text1).toContain('<!-- KAIROS:HEADER -->');
      expect(text1).toContain('<!-- KAIROS:BODY-START -->');
      expect(text1).toContain('<!-- KAIROS:BODY-END -->');
      expect(text1).toContain('<!-- KAIROS:FOOTER -->');
      const uuidMatch = text1.match(/UUID:\s*([0-9a-f-]+)/i);
      expect(uuidMatch && uuidMatch[1]).toBeDefined();
    }, 'kairos://mem first read');

    // 3) Update via markdown_doc (BODY only)
    const bodyA = `Updated BODY A ${ts}`;
    const updA = await mcpConnection.client.callTool({
      name: 'kairos_update',
      arguments: {
        uris: [memUri],
        markdown_doc: [bodyA]
      }
    });
    const updAResp = JSON.parse(updA.content[0].text);
    withRawOnFail(updAResp, () => {
      // Bulk results[] expected
      expect(Array.isArray(updAResp.results)).toBe(true);
      expect(updAResp.results[0].status).toBe('updated');
      expect(updAResp.results[0].uri).toBe(memUri);
    }, 'kairos_update(body) raw');

    const read2 = await mcpConnection.client.readResource({ uri: memUri });
    const text2 = read2.contents?.[0]?.text || '';
    const extracted2 = extractBody(text2);
    expect(extracted2).toContain(bodyA);

    // 4) Update via FULL rendered doc (we provide HEADER/BODY/FOOTER markers)
    const bodyB = `Updated BODY B ${ts}`;
    const fullDoc = `<!-- KAIROS:HEADER -->\nLabel: Test\nUUID: placeholder\n<!-- KAIROS:HEADER-END -->\n\n<!-- KAIROS:BODY-START -->\n${bodyB}\n<!-- KAIROS:BODY-END -->\n\n<!-- KAIROS:FOOTER -->\nInstruction: Modify only the content between KAIROS:BODY markers when calling kairos_update.\n<!-- KAIROS:FOOTER-END -->`;
    const updB = await mcpConnection.client.callTool({
      name: 'kairos_update',
      arguments: {
        uris: [memUri],
        markdown_doc: [fullDoc]
      }
    });
    const updBResp = JSON.parse(updB.content[0].text);
    withRawOnFail(updBResp, () => {
      // Bulk results[] expected
      expect(Array.isArray(updBResp.results)).toBe(true);
      expect(updBResp.results[0].status).toBe('updated');
      expect(updBResp.results[0].uri).toBe(memUri);
    }, 'kairos_update(full) raw');

    const read3 = await mcpConnection.client.readResource({ uri: memUri });
    const text3 = read3.contents?.[0]?.text || '';
    const extracted3 = extractBody(text3);
    expect(extracted3).toContain(bodyB);
  }, 40000);
});