/**
 * Test timeouts aligned with real client behaviour and slowdown detection.
 * Most clients timeout after 30s. Per-request timeout = roundUp(measuredResponseMs * 1.2).
 *
 * Baseline: kairos_mint is observed ≤ ~5s (~5000 ms) end-to-end on the v3 stack (embedding + store).
 * An MCP call sitting near CLIENT_TIMEOUT_MS is therefore almost never “slow mint”—it is
 * usually a stalled /mcp session or server-side deadlock, not normal tool latency.
 */

/** Typical client timeout (seconds). Tests should not exceed this. */
export const CLIENT_TIMEOUT_SEC = 30;

/** Client timeout in ms. Use as max test/suite timeout so we fail before clients would. */
export const CLIENT_TIMEOUT_MS = CLIENT_TIMEOUT_SEC * 1000;

/** Minimum per-request timeout (1s) so we never use 0 when response is very fast. */
const MIN_TIMEOUT_MS = 1000;

/**
 * Timeout from measured response time: roundUp(responseMs * 1.2), in whole seconds, capped at client timeout.
 * Example: 500ms -> 500*1.2 = 600ms -> roundUp to 1s = 1000ms.
 */
export function timeoutMsFromResponseMs(responseMs: number): number {
  const withBuffer = responseMs * 1.2;
  const roundedSec = Math.ceil(withBuffer / 1000);
  const ms = roundedSec * 1000;
  return Math.max(MIN_TIMEOUT_MS, Math.min(ms, CLIENT_TIMEOUT_MS));
}
