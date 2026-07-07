/**
 * Unit tests for mcpRateLimitErrorResult — the shared helper that converts
 * EmbeddingRateLimitError into a structured JSON MCP error result.
 */

import { beforeAll, describe, expect, test } from '@jest/globals';

describe('mcpRateLimitErrorResult', () => {
  let mcpRateLimitErrorResult: typeof import('../../src/tools/mcp-runtime-error.js').mcpRateLimitErrorResult;
  let EmbeddingRateLimitError: typeof import('../../src/services/embedding/providers.js').EmbeddingRateLimitError;

  beforeAll(async () => {
    const errMod = await import('../../src/tools/mcp-runtime-error.js');
    mcpRateLimitErrorResult = errMod.mcpRateLimitErrorResult;
    const provMod = await import('../../src/services/embedding/providers.js');
    EmbeddingRateLimitError = provMod.EmbeddingRateLimitError;
  });

  test('returns null for non-EmbeddingRateLimitError', () => {
    expect(mcpRateLimitErrorResult(new Error('generic'))).toBeNull();
    expect(mcpRateLimitErrorResult('string error')).toBeNull();
    expect(mcpRateLimitErrorResult(null)).toBeNull();
    expect(mcpRateLimitErrorResult(undefined)).toBeNull();
  });

  test('returns structured JSON for transient rate limit', () => {
    const err = new EmbeddingRateLimitError('openai', 429, 'OpenAI rate limit (429): too many requests', 'rate_limit_exceeded');
    const result = mcpRateLimitErrorResult(err);

    expect(result).not.toBeNull();
    expect(result!.isError).toBe(true);
    expect(result!.content).toHaveLength(1);
    expect(result!.content[0].type).toBe('text');

    const parsed = JSON.parse(result!.content[0].text);
    expect(parsed.error).toBe('EMBEDDING_RATE_LIMIT');
    expect(parsed.provider).toBe('openai');
    expect(parsed.http_status).toBe(429);
    expect(parsed.code).toBe('rate_limit_exceeded');
    expect(parsed.message).toContain('429');
    expect(parsed.retry_hint).toContain('Transient');
  });

  test('returns structured JSON for insufficient_quota (non-retriable)', () => {
    const err = new EmbeddingRateLimitError('openai', 429, 'OpenAI rate limit (429): insufficient quota', 'insufficient_quota');
    const result = mcpRateLimitErrorResult(err);

    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!.content[0].text);
    expect(parsed.code).toBe('insufficient_quota');
    expect(parsed.retry_hint).toContain('quota');
  });

  test('defaults code to rate_limit_exceeded when not set', () => {
    const err = new EmbeddingRateLimitError('tei', 429, 'TEI rate limit (429)');
    const result = mcpRateLimitErrorResult(err);

    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!.content[0].text);
    expect(parsed.code).toBe('rate_limit_exceeded');
    expect(parsed.provider).toBe('tei');
  });
});
