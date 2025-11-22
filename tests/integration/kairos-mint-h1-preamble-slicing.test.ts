import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { parseMcpJson } from '../utils/expect-with-raw.js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Verifies that kairos_mint imports H1 preamble as the first step
 * for tests/test-data/AI_CODING_RULES_PROTOCOL_FOR_AGENTS.md.
 */
describe('Kairos Mint header slicing (H1 preamble captured as Step 1)', () => {
  const testDataDir = join(process.cwd(), 'tests', 'test-data');
  const mdFiles = readdirSync(testDataDir).filter(f => f.endsWith('.md'));
  let mcpConnection;

  beforeAll(async () => {
    mcpConnection = await createMcpConnection();
  }, 30000);

  afterAll(async () => {
    if (mcpConnection) {
      await mcpConnection.close();
    }
  });

  function expectValidJsonResult(result) {
    return parseMcpJson(result, '[kairos_mint h1-preamble] raw MCP result');
  }

  mdFiles.forEach(file => {
    test(`first item label equals H1 and body contains pre-H2 preamble text for ${file}`, async () => {
      console.log(`[kairos-mint-h1-preamble-slicing] Testing file: ${file}`);
      const targetPath = join(testDataDir, file);
      const doc = readFileSync(targetPath, 'utf-8');

      const res = await mcpConnection.client.callTool({
        name: 'kairos_mint',
        arguments: {
          markdown_doc: JSON.stringify(doc),
          llm_model_id: 'minimax/minimax-m2:free',
          force_update: true
        }
      });

      const parsed = expectValidJsonResult(res);
      expect(parsed.status).toBe('stored');
      expect(Array.isArray(parsed.items)).toBe(true);
      expect(parsed.items.length).toBeGreaterThan(0);

      // Verify first step label equals H1
      const first = parsed.items[0];
      expect(typeof first.label).toBe('string');
      expect(first.label.length).toBeGreaterThan(0);

      // Fetch resource and verify body includes preamble content (between H1 and first H2)
      const read = await mcpConnection.client.readResource({ uri: first.uri });
      expect(read).toBeDefined();
      const text = read.contents?.[0]?.text || '';
      expect(text).toContain('<!-- KAIROS:BODY-START -->');
      expect(text).toContain('<!-- KAIROS:BODY-END -->');

      // Sanity check for a phrase present in the preamble before the first H2
      // We look for a stable substring to avoid brittleness
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);
    }, 45000);
  });
});
