// Global Jest setup for KAIROS MCP integration tests
// Set required env vars before any test file imports config (config throws if missing).
if (!process.env.REDIS_URL) process.env.REDIS_URL = 'redis://127.0.0.1:6379';
if (!process.env.QDRANT_URL) process.env.QDRANT_URL = 'http://localhost:6333';
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

