import { describe, expect, test } from '@jest/globals';
import { forwardSolutionSchema } from '../../src/tools/forward_schema.js';
import { mapProofSolution } from '../../src/tools/forward-view.js';
import { solutionToTensorValue } from '../../src/tools/forward-trace.js';

describe('unified-solution-envelope', () => {
  test('v2 shell evidence maps to proof submission shell', () => {
    const parsed = forwardSolutionSchema.parse({
      type: 'shell',
      outcome: 'success',
      evidence: { exit_code: 0, stdout: 'ok', stderr: '', duration_seconds: 0.1 }
    });
    const submission = mapProofSolution(parsed);
    expect(submission.type).toBe('shell');
    expect(submission.shell?.exit_code).toBe(0);
    expect(submission.shell?.stdout).toBe('ok');
  });

  test('v1 shell payload is accepted and maps to proof submission shell', () => {
    const parsed = forwardSolutionSchema.parse({
      type: 'shell',
      shell: { exit_code: 0, stdout: 'older-format' }
    });
    const submission = mapProofSolution(parsed);
    expect(submission.type).toBe('shell');
    expect(submission.shell?.exit_code).toBe(0);
    expect(submission.shell?.stdout).toBe('older-format');
  });

  test('v2 mcp evidence maps response -> result and derives success from outcome', () => {
    const parsed = forwardSolutionSchema.parse({
      type: 'mcp',
      outcome: 'failure',
      evidence: { tool_name: 'search', arguments: { q: 'x' }, response: { results: [] } }
    });
    const submission = mapProofSolution(parsed);
    expect(submission.type).toBe('mcp');
    expect(submission.mcp?.tool_name).toBe('search');
    expect(submission.mcp?.arguments).toEqual({ q: 'x' });
    expect(submission.mcp?.result).toEqual({ results: [] });
    expect(submission.mcp?.success).toBe(false);
  });

  test('v1 mcp payload is accepted and preserves success while renaming result -> response internally', () => {
    const parsed = forwardSolutionSchema.parse({
      type: 'mcp',
      mcp: { tool_name: 'search', arguments: { q: 'x' }, result: { results: [] }, success: true }
    });
    const submission = mapProofSolution(parsed);
    expect(submission.type).toBe('mcp');
    expect(submission.mcp?.tool_name).toBe('search');
    expect(submission.mcp?.result).toEqual({ results: [] });
    expect(submission.mcp?.success).toBe(true);
  });

  test('v2 comment evidence maps to proof submission comment', () => {
    const parsed = forwardSolutionSchema.parse({
      type: 'comment',
      outcome: 'success',
      evidence: { text: 'done' }
    });
    const submission = mapProofSolution(parsed);
    expect(submission.type).toBe('comment');
    expect(submission.comment?.text).toBe('done');
  });

  test('v2 tensor evidence produces tensor trace value', () => {
    const parsed = forwardSolutionSchema.parse({
      type: 'tensor',
      outcome: 'success',
      evidence: { name: 'foo', value: 123 }
    });
    expect(solutionToTensorValue(parsed)).toEqual({ name: 'foo', value: 123 });
  });
});
