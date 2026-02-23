// Global Jest setup for KAIROS MCP integration tests
// When AUTH_ENABLED=true, globalSetup may write .test-auth-env.json; refresh token so it stays valid, set KAIROS_BEARER_TOKEN for CLI child processes.
import { getTestBearerToken, refreshTestAuthToken } from './utils/auth-headers.js';

beforeAll(async () => {
  await refreshTestAuthToken();
  const token = getTestBearerToken();
  if (token) {
    process.env.KAIROS_BEARER_TOKEN = token;
  }
}, 15000);
export {};

