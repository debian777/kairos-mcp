import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { parseMcpJson } from '../utils/expect-with-raw.js';

describe('Kairos Mint Data Import (tests/test-data)', () => {
  // Tests all .md files in tests/test-data/ directory
  // Currently only contains AI_CODING_RULES.md (other redundant files were removed)
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
    return parseMcpJson(result, '[kairos_mint import] raw MCP result');
  }

  const testDataDir = join(process.cwd(), 'tests', 'test-data');
  let testFiles = [];
  try {
    testFiles = readdirSync(testDataDir)
      .filter(name => name.toLowerCase().endsWith('.md'))
      .map(name => join(testDataDir, name));
  } catch (err) {

    console.warn(`[kairos_mint import] Skipping test-data import: ${err instanceof Error ? err.message : String(err)}`);
  }

  for (const filePath of testFiles) {
    const fileName = filePath.split('/').pop() || filePath;
    test(`import: ${fileName}`, async () => {
      const content = JSON.stringify(readFileSync(filePath, 'utf-8'));

      const result = await mcpConnection.client.callTool({
        name: 'kairos_mint',
        arguments: {
          markdown_doc: content,
          llm_model_id: 'minimax/minimax-m2:free',
          force_update: true
        }
      });

      const response = expectValidJsonResult(result);
      expect(response).toHaveProperty('items');
      expect(Array.isArray(response.items)).toBe(true);
      expect(response.items.length).toBeGreaterThanOrEqual(1);
      expect(response.status).toBe('stored');
    }, 30000);
  }
});
