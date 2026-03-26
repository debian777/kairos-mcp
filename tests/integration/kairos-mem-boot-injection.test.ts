/**
 * Integration tests for mem boot injection.
 * Injection runs at server start (injectMemResourcesAtBoot). This test confirms mint at boot
 * by calling spaces and asserting the Kairos app space (kairos_dev) has at least 2 adapters
 * (the two mem files in src/embed-docs/mem/). Uses normal MCP connection (auth when enabled).
 * Requires dev server (npm run dev:deploy).
 */

import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { parseMcpJson } from '../utils/expect-with-raw.js';

const KAIROS_APP_SPACE_NAME = 'Kairos app';
const EXPECTED_BOOT_ADAPTER_COUNT = 2;

describe('Mem boot injection', () => {
  let mcpConnection: Awaited<ReturnType<typeof createMcpConnection>>;

  beforeAll(async () => {
    mcpConnection = await createMcpConnection();
  }, 45000);

  afterAll(async () => {
    if (mcpConnection) await mcpConnection.close();
  });

  test('spaces shows Kairos app space with at least 2 adapters (mint at boot)', async () => {
    const result = await mcpConnection.client.callTool({
      name: 'spaces',
      arguments: { include_adapter_titles: true }
    });
    if (result.isError === true && result.content?.[0]) {
      const errText = (result.content[0] as { text?: string }).text ?? String(result.content[0]);
      throw new Error(`spaces failed: ${errText}`);
    }
    expect(result.isError).not.toBe(true);
    const parsed = parseMcpJson(result, 'spaces');
    expect(parsed).toHaveProperty('spaces');
    expect(Array.isArray(parsed.spaces)).toBe(true);

    const appSpace = (parsed.spaces as Array<{ name: string; adapter_count: number; adapters?: Array<{ adapter_id: string; title: string; layer_count: number }> }>).find(
      (s) => s.name === KAIROS_APP_SPACE_NAME
    );
    expect(appSpace).toBeDefined();
    expect(appSpace!.adapter_count).toBeGreaterThanOrEqual(
      EXPECTED_BOOT_ADAPTER_COUNT,
      `Kairos app space should have at least ${EXPECTED_BOOT_ADAPTER_COUNT} adapters from mem boot (mem/ dir)`
    );
  }, 30000);
});
