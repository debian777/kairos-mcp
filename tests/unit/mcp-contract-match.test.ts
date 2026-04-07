import { describe, expect, test } from '@jest/globals';
import {
  deepMcpArgumentSubset,
  isPlainMcpArgumentsObject,
  mcpArgumentValuesMatch,
  validateMcpSubmissionAgainstContract
} from '../../src/tools/mcp-contract-match.js';
import type { ProofOfWorkDefinition } from '../../src/types/memory.js';
import { forwardContractSchema } from '../../src/tools/forward_schema.js';
import { challengeSchema } from '../../src/tools/next_schema.js';

describe('mcp-contract-match', () => {
  describe('isPlainMcpArgumentsObject', () => {
    test('accepts empty object', () => {
      expect(isPlainMcpArgumentsObject({})).toBe(true);
    });
    test('rejects null array string', () => {
      expect(isPlainMcpArgumentsObject(null)).toBe(false);
      expect(isPlainMcpArgumentsObject([])).toBe(false);
      expect(isPlainMcpArgumentsObject('x')).toBe(false);
    });
  });

  describe('deepMcpArgumentSubset', () => {
    test('empty contract accepts any plain object', () => {
      expect(deepMcpArgumentSubset({}, { a: 1, b: 2 })).toBe(true);
    });
    test('extra keys on submission allowed', () => {
      expect(deepMcpArgumentSubset({ a: 1 }, { a: 1, b: 2 })).toBe(true);
    });
    test('missing key fails', () => {
      expect(deepMcpArgumentSubset({ a: 1, b: 2 }, { a: 1 })).toBe(false);
    });
    test('nested object subset', () => {
      expect(deepMcpArgumentSubset({ outer: { x: 1 } }, { outer: { x: 1, y: 2 } })).toBe(true);
      expect(deepMcpArgumentSubset({ outer: { x: 1, y: 2 } }, { outer: { x: 1 } })).toBe(false);
    });
    test('arrays fixed length and order', () => {
      expect(deepMcpArgumentSubset({ arr: [1, 2] }, { arr: [1, 2] })).toBe(true);
      expect(deepMcpArgumentSubset({ arr: [1, 2] }, { arr: [2, 1] })).toBe(false);
      expect(deepMcpArgumentSubset({ arr: [1, 2] }, { arr: [1] })).toBe(false);
    });
    test('NaN equality', () => {
      expect(mcpArgumentValuesMatch(NaN, NaN)).toBe(true);
    });
  });

  describe('validateMcpSubmissionAgainstContract', () => {
    const baseProof: ProofOfWorkDefinition = {
      required: true,
      type: 'mcp',
      mcp: { tool_name: 'spaces' }
    };

    test('tool mismatch', () => {
      const r = validateMcpSubmissionAgainstContract(baseProof, {
        tool_name: 'forward',
        result: {},
        success: true
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe('MCP_TOOL_MISMATCH');
    });

    test('tool match', () => {
      const r = validateMcpSubmissionAgainstContract(baseProof, {
        tool_name: 'spaces',
        result: {},
        success: true
      });
      expect(r.ok).toBe(true);
    });

    test('arguments required but missing', () => {
      const proof: ProofOfWorkDefinition = {
        ...baseProof,
        mcp: { tool_name: 'spaces', arguments: { limit: 1 } }
      };
      const r = validateMcpSubmissionAgainstContract(proof, {
        tool_name: 'spaces',
        result: {},
        success: true
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe('MISSING_FIELD');
    });

    test('arguments non-object', () => {
      const proof: ProofOfWorkDefinition = {
        ...baseProof,
        mcp: { tool_name: 'spaces', arguments: {} }
      };
      const r = validateMcpSubmissionAgainstContract(proof, {
        tool_name: 'spaces',
        arguments: null as unknown as Record<string, unknown>,
        result: {},
        success: true
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe('MCP_ARGUMENTS_MISMATCH');
    });

    test('arguments subset success', () => {
      const proof: ProofOfWorkDefinition = {
        ...baseProof,
        mcp: { tool_name: 'spaces', arguments: { limit: 1 } }
      };
      const r = validateMcpSubmissionAgainstContract(proof, {
        tool_name: 'spaces',
        arguments: { limit: 1, extra: true },
        result: {},
        success: true
      });
      expect(r.ok).toBe(true);
    });

    test('arguments value mismatch', () => {
      const proof: ProofOfWorkDefinition = {
        ...baseProof,
        mcp: { tool_name: 'spaces', arguments: { limit: 1 } }
      };
      const r = validateMcpSubmissionAgainstContract(proof, {
        tool_name: 'spaces',
        arguments: { limit: 2 },
        result: {},
        success: true
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe('MCP_ARGUMENTS_MISMATCH');
    });
  });

  describe('forwardContractSchema mcp.arguments', () => {
    test('parses optional arguments', () => {
      const out = forwardContractSchema.parse({
        type: 'mcp',
        mcp: {
          tool_name: 't',
          arguments: { a: 1, nested: { b: 'c' } }
        }
      });
      expect(out.mcp?.arguments).toEqual({ a: 1, nested: { b: 'c' } });
    });
  });
});

describe('next_schema challenge mcp.arguments', () => {
  test('parses challenge with mcp.arguments', () => {
    const out = challengeSchema.parse({
      type: 'mcp',
      description: 'd',
      mcp: { tool_name: 'x', arguments: { k: 1 } }
    });
    expect(out.mcp?.arguments).toEqual({ k: 1 });
  });
});
