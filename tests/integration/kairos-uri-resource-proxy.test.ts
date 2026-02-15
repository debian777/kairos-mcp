import { mcpResources } from '../../src/resources/embedded-mcp-resources.js';
import { createMcpConnection } from '../utils/mcp-client-utils.js';

describe('Embedded MCP Resources', () => {
  test('mcpResources contains prompts', () => {
    expect(mcpResources).toHaveProperty('prompts');
    expect(Object.keys(mcpResources.prompts).length).toBeGreaterThan(0);
    for (const [, content] of Object.entries(mcpResources.prompts)) {
      expect(typeof content).toBe('string');
      expect(content.length).toBeGreaterThan(10);
    }
  });

  test('mcpResources contains tools', () => {
    expect(mcpResources).toHaveProperty('tools');
    expect(Object.keys(mcpResources.tools).length).toBeGreaterThan(0);
    for (const [, content] of Object.entries(mcpResources.tools)) {
      expect(typeof content).toBe('string');
      expect(content.length).toBeGreaterThan(10);
    }
  });

  test('mcpResources templates exist', () => {
    expect(mcpResources).toHaveProperty('templates');
    // Templates may contain entries (e.g., kairos-memory)
    expect(typeof mcpResources.templates).toBe('object');
  });
});

describe('Special static memory resources', () => {
  test('mcpResources.mem is empty (mem files are read from filesystem at runtime)', () => {
    expect(mcpResources).toHaveProperty('mem');
    const mem = mcpResources.mem;
    expect(typeof mem).toBe('object');
    // mem/ files are now read from filesystem at runtime in mem-resources-boot.ts
    // They are no longer embedded in the generated file
    expect(Object.keys(mem).length).toBe(0);
  });
});

describe('MCP Tools and Resources', () => {
  let mcp;

  beforeAll(async () => {
    mcp = await createMcpConnection();
  }, 45000);

  afterAll(async () => {
    if (mcp) await mcp.close();
  });
  
  test('tools match mcpResources.tools (each tool has non-empty description; exact text may differ if server build differs)', async () => {
    const tools = await mcp.client.listTools();
    const toolNames = Object.keys(mcpResources.tools);
    expect(tools.tools).toHaveLength(toolNames.length);
    for (const name of toolNames) {
      const tool = tools.tools.find(t => t.name === name);
      expect(tool).toBeDefined();
      expect(typeof tool?.description).toBe('string');
      expect(tool?.description.length).toBeGreaterThan(20);
    }
  }, 30000);

  test('resources/list returns registered resources', async () => {
    const resources = await mcp.client.listResources();
    expect(Array.isArray(resources.resources)).toBe(true);
    expect(resources.resources.length).toBeGreaterThan(0);
    // Verify the minting guide resource is registered
    const mintingGuide = resources.resources.find((r: any) => r.uri === 'kairos://doc/building-kairos-workflows');
    expect(mintingGuide).toBeDefined();
    expect(mintingGuide?.name).toBe('Building-Kairos-Workflows');
    expect(mintingGuide?.mimeType).toBe('text/markdown');
  }, 30000);

  test('resources/templates/list returns empty array when no templates are registered', async () => {
    const templates = await mcp.client.listResourceTemplates();
    expect(Array.isArray(templates.resourceTemplates)).toBe(true);
    expect(templates.resourceTemplates.length).toBe(0);
  }, 30000);
});

