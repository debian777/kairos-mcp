/**
 * Unit tests for buildChallengeShapeForDisplay: MCP output schema safety for stored proofs.
 */

import { describe, expect, jest, test } from '@jest/globals';
import { buildChallengeShapeForDisplay } from '../../src/tools/kairos-challenge-display.js';
import { structuredLogger } from '../../src/utils/structured-logger.js';

describe('buildChallengeShapeForDisplay', () => {
  test('undefined type defaults to shell challenge shape', () => {
    const shape = buildChallengeShapeForDisplay({
      required: true,
      shell: { cmd: 'echo hi', timeout_seconds: 5 }
    } as any);
    expect(shape.type).toBe('shell');
    expect(shape.shell).toMatchObject({ cmd: 'echo hi', timeout_seconds: 5 });
    expect(String(shape.description)).toContain('shell');
  });

  test('invalid stored type is coerced to comment with valid schema fields', () => {
    const warn = jest.spyOn(structuredLogger, 'warn').mockImplementation(() => {});

    const shape = buildChallengeShapeForDisplay({
      type: 'comment|user_input|mcp|shell' as any,
      required: true,
      comment: { min_length: 50 }
    } as any);

    expect(shape.type).toBe('comment');
    expect(shape.comment).toEqual({ min_length: 50 });
    expect(String(shape.description)).toMatch(/minimum 50/);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
