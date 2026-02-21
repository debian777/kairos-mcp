/**
 * Kairos Mint integration tests for docs/examples (workflow test — imports scenario).
 *
 * Mints each mintable protocol from docs/examples/ via kairos_mint. Used in dev/qa
 * to validate that canonical examples can be imported; complements agent-driven
 * workflow tests in tests/workflow-test/.
 */

import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { parseMcpJson } from '../utils/expect-with-raw.js';

describe('Kairos Mint Docs Examples (docs/examples)', () => {
  let mcpConnection;

  beforeAll(async () => {
    mcpConnection = await createMcpConnection();
  });

  afterAll(async () => {
    if (mcpConnection) {
      await mcpConnection.close();
    }
  });

  function expectValidJsonResult(result: unknown) {
    return parseMcpJson(result, '[kairos_mint docs/examples] raw MCP result');
  }

  const examplesDir = join(process.cwd(), 'docs', 'examples');
  let testFiles: string[] = [];
  try {
    testFiles = readdirSync(examplesDir)
      .filter((name) => name.startsWith('protocol-example-') && name.toLowerCase().endsWith('.md'))
      .map((name) => join(examplesDir, name));
  } catch (err) {
    // eslint-disable-next-line no-console -- test setup; failure is reported below
    console.warn(
      `[kairos_mint docs/examples] Skipping: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  for (const filePath of testFiles) {
    const fileName = filePath.split('/').pop() ?? filePath;
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

  if (testFiles.length === 0) {
    test('docs/examples has at least one protocol-example-*.md', () => {
      expect(testFiles.length).toBeGreaterThan(0);
    });
  }
});
