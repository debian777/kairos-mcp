// Global Jest setup for KAIROS MCP integration tests
// Set required env vars before any test file imports config (config throws if missing).
// REDIS_URL set (non-empty) → Redis; unset or empty → in-memory. Default test env uses Redis (only set when key missing).
if (process.env.REDIS_URL === undefined || process.env.REDIS_URL === null) {
  process.env.REDIS_URL = 'redis://127.0.0.1:6379';
}
if (!process.env.QDRANT_URL) process.env.QDRANT_URL = 'http://localhost:6333';

// Optional: debug what env the test process sees (DEBUG_TEST_ENV=1 npm run dev:test)
if (process.env.DEBUG_TEST_ENV === '1') {
  const k = (key: string) => `${key}=${process.env[key] !== undefined ? '<set>' : '<unset>'}`;
  console.log(
    '[DEBUG_TEST_ENV]',
    ['ENV', 'QDRANT_COLLECTION', 'QDRANT_URL', 'REDIS_URL', 'AUTH_ENABLED', 'PORT'].map(k).join(' ')
  );
}

// When AUTH_ENABLED=true, globalSetup writes .test-auth-env.dev.json. Refresh token so it stays valid.
// CLI uses XDG_CONFIG_HOME (set by test runner); integration tests run "cli login --token" then run commands.
import { refreshTestAuthToken } from './utils/auth-headers.js';

beforeAll(async () => {
  await refreshTestAuthToken();
}, 15000);
export {};

