import { describe, expect, test } from '@jest/globals';
import { activateInputSchema } from '../../src/tools/activate_schema.js';
import { rewardInputSchema } from '../../src/tools/reward_schema.js';
import { trainInputSchema } from '../../src/tools/train_schema.js';
import { tuneInputSchema } from '../../src/tools/tune_schema.js';
import { deleteInputSchema } from '../../src/tools/delete_schema.js';
import { exportInputSchema } from '../../src/tools/export_schema.js';
import { buildMcpInputTeachingPayload } from '../../src/tools/mcp-tool-input-teaching.js';

describe('mcp-tool-input-teaching branches', () => {
  test.each([
    ['activate', activateInputSchema.safeParse({}), {}],
    ['reward', rewardInputSchema.safeParse({}), {}],
    ['train', trainInputSchema.safeParse({}), {}],
    ['tune', tuneInputSchema.safeParse({}), {}],
    ['delete', deleteInputSchema.safeParse({}), {}],
    ['export', exportInputSchema.safeParse({}), {}]
  ] as const)('%s returns structured example and retry metadata', (tool, parsed, raw) => {
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const payload = buildMcpInputTeachingPayload(tool, parsed.error, raw);
    expect(payload.error).toBe('INVALID_TOOL_INPUT');
    expect(payload.example).toBeDefined();
    expect(payload.retry_count).toBeGreaterThanOrEqual(1);
    expect(payload.max_retries).toBe(3);
    expect(Array.isArray(payload.invalid_fields)).toBe(true);
  });
});
