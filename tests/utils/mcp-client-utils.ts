/**
 * MCP Client Connection Utilities for Integration Tests
 * Provides reusable connection setup and teardown functions.
 * When AUTH_ENABLED=true, globalSetup creates the test user and token; we send it so all tests use auth.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { waitForHealthCheck } from './health-check.js';
import {
  getMcpTestBearerToken,
  getTestAuthBaseUrl,
  refreshTestAuthToken,
  serverRequiresAuth
} from './auth-headers.js';

/** Base URL of the app (same server for MCP and health). From MCP_URL env or getTestAuthBaseUrl() (e.g. .test-auth-env.json when auth server runs). */
const BASE_URL = process.env.MCP_URL
  ? process.env.MCP_URL.replace(/\/mcp\/?$/, '').replace(/\/$/, '')
  : getTestAuthBaseUrl().replace(/\/$/, '');
const MCP_URL = `${BASE_URL}/mcp`;
const HEALTH_URL = process.env.HEALTH_URL || `${BASE_URL}/health`;

async function buildAuthHeaders(headersInit?: HeadersInit): Promise<Headers> {
  const headers = new Headers(headersInit);
  if (!serverRequiresAuth()) {
    return headers;
  }
  if (!getMcpTestBearerToken()) {
    await refreshTestAuthToken();
  }
  const token = getMcpTestBearerToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

async function authedFetch(input: URL | RequestInfo, init?: RequestInit): Promise<Response> {
  const firstResponse = await fetch(input, {
    ...init,
    headers: await buildAuthHeaders(init?.headers)
  });
  if (!serverRequiresAuth() || firstResponse.status !== 401) {
    return firstResponse;
  }

  await firstResponse.body?.cancel().catch(() => undefined);
  const refreshed = await refreshTestAuthToken();
  if (!refreshed) {
    return firstResponse;
  }

  return fetch(input, {
    ...init,
    headers: await buildAuthHeaders(init?.headers)
  });
}

// McpConnection JSDoc typedef (converted from TypeScript interface)
/**
 * @typedef {Object} McpConnection
 * @property {Client} client
 * @property {StreamableHTTPClientTransport} transport
 * @property {() => Promise<void>} close
 */

/**
 * Creates a new MCP client connection with proper health checking
 * @returns Promise that resolves to an McpConnection object
 */
export async function createMcpConnection() {
  // Wait for server to be ready before attempting connection
  await waitForHealthCheck({
    url: HEALTH_URL,
    timeoutMs: 60000, // 60 seconds for integration tests
    intervalMs: 2000   // Check every 2 seconds
  });

  const client = new Client({
    name: 'kb-integration-tests',
    version: '1.0.0'
  });

  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    fetch: authedFetch
  });
  await client.connect(transport);

  // Return connection object with cleanup function
  return {
    client,
    transport,
    close: async () => {
      try {
        await client.close();
      } catch (error) {
        console.warn('Error closing MCP client:', error);
      }
    }
  };
}

/**
 * Creates a shared MCP connection suitable for multiple test files
 * This is a singleton pattern to avoid multiple connections
 */
let sharedConnection = null;
let sharedConnectionPromise = null;

export async function getSharedMcpConnection() {
  if (sharedConnection) {
    return sharedConnection;
  }

  if (!sharedConnectionPromise) {
    sharedConnectionPromise = createMcpConnection();
  }

  sharedConnection = await sharedConnectionPromise;
  return sharedConnection;
}