/**
 * HTTP + auth integration harness: uses the same MCP Streamable HTTP path as the rest of the suite.
 * Run only when the stack is up with AUTH_ENABLED=true (e.g. npm run dev:deploy + test:integration:contracts:http-auth).
 */

import { createMcpConnection } from '../../utils/mcp-client-utils.js';
import { serverRequiresAuth } from '../../utils/auth-headers.js';
import { SCENARIOS } from './scenario.js';
import type { TestHarness } from './types.js';
import { callToolJson } from './helpers/mcp-call-normalize.js';

export async function createHttpAuthHarness(): Promise<TestHarness> {
  if (!serverRequiresAuth()) {
    throw new Error(
      'createHttpAuthHarness requires AUTH_ENABLED=true and a running dev stack (e.g. npm run test:integration:contracts:http-auth after npm run dev:deploy).'
    );
  }
  const conn = await createMcpConnection();
  return {
    scenario: SCENARIOS['http-auth'],
    callTool: (name, args) => callToolJson(conn.client, name, args),
    close: conn.close
  };
}
