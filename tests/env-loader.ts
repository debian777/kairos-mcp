/**
 * Environment loader stub.
 * 
 * Previously loaded .env files via dotenv/config, but this was redundant because:
 * - Jest's setupFiles runs before EACH test file (85+ times for integration tests)
 * - globalSetup (tests/global-setup-auth.ts) already loads env vars ONCE before all tests
 * - Jest workers inherit process.env from globalSetup
 * 
 * This file is kept in setupFiles to preserve the existing Jest configuration structure.
 * The normalizeRedisUrl helper is retained for potential use by setup.ts if needed.
 */

/**
 * Normalize Redis URL by embedding password if not already present.
 * Kept for reference; global-setup-auth.ts now handles this during initial env load.
 */
export function normalizeRedisUrl(rawUrl: string | undefined, rawPassword: string | undefined): string {
  const url = (rawUrl || '').trim();
  const password = (rawPassword || '').trim();
  if (!url || !password) return url;
  try {
    const parsed = new URL(url);
    if ((parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') || parsed.username || parsed.password) {
      return url;
    }
    parsed.password = password;
    return parsed.toString();
  } catch {
    return url;
  }
}

// No-op: environment is now loaded once by globalSetup (tests/global-setup-auth.ts)
// This prevents 85+ redundant dotenv log messages during integration test runs.
