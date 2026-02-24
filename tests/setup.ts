// Global Jest setup for KAIROS MCP integration tests
// Set required env vars before any test file imports config (config throws if missing).
if (!process.env.REDIS_URL) process.env.REDIS_URL = 'redis://127.0.0.1:6379';
if (!process.env.QDRANT_URL) process.env.QDRANT_URL = 'http://localhost:6333';

export { };

