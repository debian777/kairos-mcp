import { getSharedMcpConnection } from '../utils/mcp-client-utils.js';
import { withRawOnFail } from '../utils/expect-with-raw.js';

describe('MCP Client Connection', () => {
  let sharedConnection;

  beforeAll(async () => {
    sharedConnection = await getSharedMcpConnection();
  });

  test('connection establishes successfully', async () => {
    withRawOnFail(sharedConnection, () => {
      expect(sharedConnection).toBeDefined();
      expect(sharedConnection.client).toBeDefined();
      expect(sharedConnection.transport).toBeDefined();
      // Verify connection is working by checking client state
      expect(sharedConnection.client).toBeTruthy();
    }, 'mcp client connection object');
  });
});
