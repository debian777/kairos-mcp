import { describe, expect, test } from '@jest/globals';
import { forwardInputSchema } from '../../src/tools/forward_schema.js';
import { buildMcpInputTeachingPayload } from '../../src/tools/mcp-tool-input-teaching.js';

describe('mcp-tool-input-teaching', () => {
  test('forward missing uri includes next_action and INVALID_TOOL_INPUT', () => {
    const parsed = forwardInputSchema.safeParse({});
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const body = buildMcpInputTeachingPayload('forward', parsed.error, {});
    expect(body.error).toBe('INVALID_TOOL_INPUT');
    expect(body.tool).toBe('forward');
    expect(body.must_obey).toBe(true);
    expect(String(body.message)).toContain('Input validation error');
    expect(String(body.next_action)).toContain('forward');
    expect(String(body.next_action)).toContain('uri');
  });
});
