import { getSharedMcpConnection } from '../utils/mcp-client-utils.js';
import { withRawOnFail } from '../utils/expect-with-raw.js';

describe('MCP Client Connection', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sharedConnection: any;

  beforeAll(async () => {
    sharedConnection = await getSharedMcpConnection();
  });

  afterAll(async () => {
    if (sharedConnection) await sharedConnection.close();
  });

  test('connection establishes successfully', async () => {
    withRawOnFail(sharedConnection, () => {
      expect(sharedConnection).toBeDefined();
      expect(sharedConnection.client).toBeDefined();
      // In stdio mode the shared connection keeps the transport internal (null);
      // in HTTP mode the transport object is returned.
      if (sharedConnection.transport !== null) {
        expect(sharedConnection.transport).toBeDefined();
      }
      // Verify connection is working by checking client state
      expect(sharedConnection.client).toBeTruthy();
    }, 'mcp client connection object');
  });

  test('can list tools', async () => {
    const toolsResult = await sharedConnection.client.listTools();
    expect(Array.isArray(toolsResult.tools)).toBe(true);
    expect(toolsResult.tools.length).toBeGreaterThan(0);
  });
});
