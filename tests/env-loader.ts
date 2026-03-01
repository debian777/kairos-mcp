/**
 * Test env: no automatic .env loading here.
 * For npm test, env comes from the shell (REDIS_URL unset = memory backend).
 * For test:integration, dotenv -e .env loads .env before invoking npm test.
 */
// No-op: env is either inherited (test:integration) or intentionally minimal (npm test).
