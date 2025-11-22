/**
 * MCP Client Connection Utilities for Integration Tests
 * Provides reusable connection setup and teardown functions
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { waitForHealthCheck } from './health-check.js';

const MCP_URL = process.env.MCP_URL || 'http://localhost:3300/mcp';
const HEALTH_URL = process.env.HEALTH_URL || MCP_URL.replace('/mcp', '/health');

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

  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
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

/**
 * Cleans up the shared connection
 * Should be called once after all tests complete
 */
export async function cleanupSharedMcpConnection() {
  if (sharedConnection) {
    await sharedConnection.close();
    sharedConnection = null;
  }
  sharedConnectionPromise = null;
}

/**
 * Helper to check if a client is connected
 * @param client The MCP client to check
 * @returns True if the client appears to be connected
 */
export function isClientConnected(client) {
  // This is a simple check - in a real implementation you might want
  // to check the transport state more thoroughly
  return client !== null && client !== undefined;
}