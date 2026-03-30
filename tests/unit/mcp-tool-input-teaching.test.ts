import { describe, expect, test } from '@jest/globals';
import { forwardInputSchema, forwardMcpWireInputSchema } from '../../src/tools/forward_schema.js';
import { buildMcpInputTeachingPayload } from '../../src/tools/mcp-tool-input-teaching.js';

describe('mcp-tool-input-teaching', () => {
  const LAYER_WITH_EXEC = 'kairos://layer/00000000-0000-0000-0000-000000000002?execution_id=00000000-0000-0000-0000-000000000003';

  test('forward MCP wire schema accepts empty object so handler can teach', () => {
    const wire = forwardMcpWireInputSchema.safeParse({});
    expect(wire.success).toBe(true);
  });

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

  test('forward continuation call without solution explains same-run requirement', () => {
    const parsed = forwardInputSchema.safeParse({ uri: LAYER_WITH_EXEC });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const body = buildMcpInputTeachingPayload('forward', parsed.error, { uri: LAYER_WITH_EXEC });
    expect(body.error).toBe('INVALID_TOOL_INPUT');
    expect(Array.isArray(body.invalid_fields) ? body.invalid_fields : []).toContain('solution');
    expect(String(body.message)).toContain('same execution chain');
  });

  test('forward start call with solution teaches omit solution on start', () => {
    const ADAPTER_URI = 'kairos://adapter/00000000-0000-0000-0000-000000000001';
    const parsed = forwardInputSchema.safeParse({
      uri: ADAPTER_URI,
      solution: { type: 'comment', comment: { text: 'x' } }
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const body = buildMcpInputTeachingPayload('forward', parsed.error, {});
    expect(body.error).toBe('INVALID_TOOL_INPUT');
    expect(String(body.message)).toContain('Omit `solution` when starting');
    expect(String(body.next_action)).toContain('omit `solution`');
  });
});
