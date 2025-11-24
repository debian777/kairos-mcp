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

  test('mcpResources templates are empty (resource templates removed)', () => {
    expect(mcpResources).toHaveProperty('templates');
    expect(Object.keys(mcpResources.templates).length).toBe(0);
  });
});

describe('Special static memory resources', () => {
  test('mcpResources.mem contains UUID keys with valid content', () => {
    expect(mcpResources).toHaveProperty('mem');
    const mem = mcpResources.mem;
    expect(typeof mem).toBe('object');
    for (const [key, content] of Object.entries(mem)) {
      console.log('Testing key:', key);
      console.log('Content preview  :', content.slice(0, 30) + '...');
      // Keys are now just the filename (UUID), not kairos://mem/{uuid}
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
      expect(typeof content).toBe('string');
      expect(content.length).toBeGreaterThan(10);
    }
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
  
  test('tools match mcpResources.tools', async () => {
    const tools = await mcp.client.listTools();
    const expectedTools = Object.entries(mcpResources.tools).map(([name, description]) => ({
      name,
      description,
    }));
    expect(tools.tools).toHaveLength(expectedTools.length);
    for (const expected of expectedTools) {
      const tool = tools.tools.find(t => t.name === expected.name);
      expect(tool).toBeDefined();
      expect(tool?.description).toBe(expected.description);
    }
  }, 30000);

  test('resources/list returns empty array when no resources are registered', async () => {
    const resources = await mcp.client.listResources();
    expect(Array.isArray(resources.resources)).toBe(true);
    expect(resources.resources.length).toBe(0);
  }, 30000);

  test('resources/templates/list returns empty array when no templates are registered', async () => {
    const templates = await mcp.client.listResourceTemplates();
    expect(Array.isArray(templates.resourceTemplates)).toBe(true);
    expect(templates.resourceTemplates.length).toBe(0);
  }, 30000);
});

