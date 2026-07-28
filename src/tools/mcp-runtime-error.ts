import { EmbeddingRateLimitError } from '../services/embedding/providers.js';

/**
 * Build a structured MCP error result for an embedding provider rate-limit error.
 *
 * Without this, a 429 surfaces as a raw error string (e.g.
 * "OpenAI rate limit (429): ...") that breaks client `JSON.parse` of the tool
 * `content[0].text`. Returning structured JSON lets clients parse a clear,
 * actionable `EMBEDDING_RATE_LIMIT` payload instead.
 *
 * Returns `null` for non-rate-limit errors so the caller preserves existing
 * behavior (re-throw) for those.
 */
export function mcpRateLimitErrorResult(
    error: unknown
): { isError: true; content: [{ type: 'text'; text: string }] } | null {
    if (!(error instanceof EmbeddingRateLimitError)) return null;
    const isQuota = error.code === 'insufficient_quota';
    return {
        isError: true,
        content: [{
            type: 'text',
            text: JSON.stringify({
                error: 'EMBEDDING_RATE_LIMIT',
                provider: error.provider,
                http_status: error.httpStatus,
                code: error.code ?? 'rate_limit_exceeded',
                message: error.message,
                retry_hint: isQuota
                    ? 'OpenAI account is out of quota. Add billing/quota, then retry.'
                    : 'Transient rate limit. Wait and retry, or reduce request rate.'
            })
        }]
    };
}
