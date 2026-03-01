// Global Jest setup for KAIROS MCP integration tests
// Set QDRANT_URL default so tests work without .env. REDIS_URL left unset for npm test (memory backend); test:integration loads .env (Redis).
if (!process.env.QDRANT_URL) process.env.QDRANT_URL = 'http://localhost:6333';

// Optional: debug what env the test process sees (DEBUG_TEST_ENV=1 npm run dev:test)
if (process.env.DEBUG_TEST_ENV === '1') {
  const k = (key: string) => `${key}=${process.env[key] !== undefined ? '<set>' : '<unset>'}`;
  console.log(
    '[DEBUG_TEST_ENV]',
    ['ENV', 'QDRANT_COLLECTION', 'QDRANT_URL', 'REDIS_URL', 'AUTH_ENABLED', 'PORT'].map(k).join(' ')
  );
}

// When AUTH_ENABLED=true, globalSetup writes env-specific .test-auth-env.{dev,qa}.json; refresh token so it stays valid, set KAIROS_BEARER_TOKEN for CLI child processes.
import { getTestBearerToken, refreshTestAuthToken } from './utils/auth-headers.js';

beforeAll(async () => {
  await refreshTestAuthToken();
  const token = getTestBearerToken();
  if (token) {
    process.env.KAIROS_BEARER_TOKEN = token;
  }
}, 15000);
export {};

