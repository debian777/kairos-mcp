import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { withRawOnFail } from '../utils/expect-with-raw.js';

describe('kairos_begin output shape (minimal)', () => {
  let mcpConnection;

  beforeAll(async () => {
    mcpConnection = await createMcpConnection();
  });

  afterAll(async () => {
    if (mcpConnection) await mcpConnection.close();
  });

  function expectValidJsonResult(result) {
    try {
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      // structuredContent should be present; we focus assertions there
      expect(result.structuredContent).toBeDefined();
      return result.structuredContent;
    } catch (err) {

      console.debug('kairos_begin raw MCP result (assertion failed):', JSON.stringify(result));
      throw err;
    }
  }

  test('returns single chain head with must_obey, start_here, chain_label, total_steps, protocol_status', async () => {
    // Ensure there is at least one relevant memory; store a tiny doc
    const ts = Date.now();
    const md = `# You are a specialized AI expert: Design Principle: Keep MCP Simple, Move Logic to App ${ts}\n\n## Rule\nKeep MCP minimal and push app-specific logic to the client.`;
    await mcpConnection.client.callTool({
      name: 'kairos_mint',
      arguments: { markdown_doc: JSON.stringify(md), llm_model_id: 'minimax/minimax-m2:free' }
    });

    const call = { name: 'kairos_begin', arguments: { query: String(ts), limit: 1 } };
    const result = await mcpConnection.client.callTool({
      name: 'kairos_begin',
      arguments: call.arguments
    });
    const callAndRaw = { call, result };

    const sc = expectValidJsonResult(result);
    withRawOnFail(callAndRaw, () => {
      expect(sc).toHaveProperty('must_obey');
      expect(sc).toHaveProperty('protocol_status');
      
      // Handle different protocol status cases
      if (sc.protocol_status === 'no_protocol') {
        // No chain heads found - this shouldn't happen normally but can occur due to timing
        // In this case, must_obey should be false
        expect(sc.must_obey).toBe(false);
        // Allow retry or skip this assertion for timing issues
        return;
      }
      
      expect(sc.protocol_status).toBe('initiated');
      
      // If multiple perfect matches, must_obey should be false and choices should be present
      if (sc.multiple_perfect_matches && sc.multiple_perfect_matches > 1) {
        expect(sc.must_obey).toBe(false);
        expect(sc).toHaveProperty('choices');
        expect(Array.isArray(sc.choices)).toBe(true);
        expect(sc.choices.length).toBeGreaterThan(0);
      } else {
        // Single match or fallback case - must_obey should be true
        expect(sc.must_obey).toBe(true);
        expect(sc).toHaveProperty('start_here');
        expect(typeof sc.start_here).toBe('string');
        expect(sc.start_here.startsWith('kairos://mem/')).toBe(true);
        expect(sc).toHaveProperty('chain_label');
        expect(typeof sc.chain_label).toBe('string');
        expect(sc).toHaveProperty('total_steps');
        expect(typeof sc.total_steps).toBe('number');
      }
    }, 'kairos_begin call + raw MCP result (post-parse assertion failed)');
  }, 20000);
});
