import type { ProofOfWorkDefinition } from '../types/memory.js';

/** True for JSON-like objects (not null, not array). */
export function isPlainMcpArgumentsObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function samePrimitive(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  return Number.isNaN(a as number) && Number.isNaN(b as number);
}

/**
 * Contract value vs submission value: objects use subset semantics; arrays are fixed length with per-index matching; primitives use SameValue.
 */
export function mcpArgumentValuesMatch(contractValue: unknown, submissionValue: unknown): boolean {
  if (Array.isArray(contractValue)) {
    if (!Array.isArray(submissionValue) || contractValue.length !== submissionValue.length) {
      return false;
    }
    return contractValue.every((cv, i) => mcpArgumentValuesMatch(cv, submissionValue[i]));
  }
  if (contractValue !== null && typeof contractValue === 'object') {
    if (!isPlainMcpArgumentsObject(submissionValue)) return false;
    const c = contractValue as Record<string, unknown>;
    const s = submissionValue;
    for (const key of Object.keys(c)) {
      if (!mcpArgumentValuesMatch(c[key], s[key])) return false;
    }
    return true;
  }
  return samePrimitive(contractValue, submissionValue);
}

/** Every key in `contractArgs` must match the corresponding value in `submissionArgs`; extra submission keys allowed at each object level. */
export function deepMcpArgumentSubset(contractArgs: Record<string, unknown>, submissionArgs: Record<string, unknown>): boolean {
  for (const key of Object.keys(contractArgs)) {
    if (!mcpArgumentValuesMatch(contractArgs[key], submissionArgs[key])) return false;
  }
  return true;
}

export type McpContractValidation =
  | { ok: true }
  | { ok: false; code: 'MCP_TOOL_MISMATCH' | 'MCP_ARGUMENTS_MISMATCH' | 'MISSING_FIELD'; message: string };

export function validateMcpSubmissionAgainstContract(
  proof: ProofOfWorkDefinition,
  mcp: { tool_name: string; arguments?: unknown }
): McpContractValidation {
  if (proof.type !== 'mcp' || !proof.mcp) {
    return { ok: true };
  }
  const expectedTool = proof.mcp.tool_name;
  if (expectedTool !== undefined && expectedTool !== '' && mcp.tool_name !== expectedTool) {
    return {
      ok: false,
      code: 'MCP_TOOL_MISMATCH',
      message: `MCP tool_name must match the contract (expected "${expectedTool}", got "${mcp.tool_name}").`
    };
  }
  if (proof.mcp.arguments !== undefined) {
    if (mcp.arguments === undefined) {
      return {
        ok: false,
        code: 'MISSING_FIELD',
        message: 'MCP proof requires solution.mcp.arguments (object) because the contract specifies mcp.arguments.'
      };
    }
    if (!isPlainMcpArgumentsObject(mcp.arguments)) {
      return {
        ok: false,
        code: 'MCP_ARGUMENTS_MISMATCH',
        message: 'solution.mcp.arguments must be a plain object when the contract specifies mcp.arguments.'
      };
    }
    if (!deepMcpArgumentSubset(proof.mcp.arguments, mcp.arguments)) {
      return {
        ok: false,
        code: 'MCP_ARGUMENTS_MISMATCH',
        message: 'solution.mcp.arguments does not satisfy the contract (required keys must match values, including nested objects).'
      };
    }
  }
  return { ok: true };
}
