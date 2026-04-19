/**
 * Transport-neutral MCP contract for the `spaces` tool (list spaces + validation errors).
 */

import type { TestHarness } from '../harness/types.js';

export function runSpacesToolContract(
  suiteName: string,
  createHarness: () => Promise<TestHarness>
): void {
  describe(suiteName, () => {
    let harness: TestHarness;

    beforeAll(async () => {
      harness = await createHarness();
    }, 120000);

    afterAll(async () => {
      await harness.close();
    });

    test('returns a spaces array for valid empty input', async () => {
      const result = (await harness.callTool('spaces', {})) as {
        spaces?: Array<{ name?: string; space_id?: string; adapter_count?: number }>;
      };
      expect(result.spaces).toBeDefined();
      expect(Array.isArray(result.spaces)).toBe(true);
      expect(result.spaces!.length).toBeGreaterThan(0);
      const first = result.spaces![0];
      expect(first).toMatchObject({
        name: expect.any(String),
        space_id: expect.any(String)
      });
      expect(typeof first?.adapter_count).toBe('number');
    });

    test('rejects non-boolean optional fields with INVALID_TOOL_INPUT', async () => {
      await expect(
        harness.callTool('spaces', { include_adapter_titles: 'not-a-boolean' })
      ).rejects.toThrow(/INVALID_TOOL_INPUT|spaces|boolean/i);
    });
  });
}
