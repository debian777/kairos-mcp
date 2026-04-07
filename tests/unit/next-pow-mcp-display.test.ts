import { describe, expect, test } from '@jest/globals';
import { buildChallengeShapeForDisplay } from '../../src/tools/next-pow-challenge-shape.js';

describe('next-pow-helpers buildChallengeShapeForDisplay mcp.arguments', () => {
  test('includes arguments in mcp payload and description when set', () => {
    const shape = buildChallengeShapeForDisplay({
      required: true,
      type: 'mcp',
      mcp: { tool_name: 'spaces', arguments: { limit: 1 } }
    } as any);
    expect(shape.type).toBe('mcp');
    expect((shape.mcp as Record<string, unknown>).tool_name).toBe('spaces');
    expect((shape.mcp as Record<string, unknown>).arguments).toEqual({ limit: 1 });
    expect(String(shape.description)).toContain('subset');
    expect(String(shape.description)).toContain('limit');
  });
});
