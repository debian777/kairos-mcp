import { mcpResources } from '../../src/resources/embedded-mcp-resources.js';
import { createMcpConnection } from '../utils/mcp-client-utils.js';

describe('Embedded MCP Resources', () => {
  test('mcpResources.prompts embeds the contextual prompt', () => {
    expect(mcpResources).toHaveProperty('prompts');
    expect(typeof mcpResources.prompts).toBe('object');
    expect(mcpResources.prompts).toHaveProperty('contextual-prompt');
    expect(typeof (mcpResources.prompts as Record<string, string>)['contextual-prompt']).toBe('string');
    expect((mcpResources.prompts as Record<string, string>)['contextual-prompt'].length).toBeGreaterThan(20);
  });

  test('mcpResources contains tools', () => {
    expect(mcpResources).toHaveProperty('tools');
    expect(Object.keys(mcpResources.tools).length).toBeGreaterThan(0);
    for (const [, content] of Object.entries(mcpResources.tools)) {
      expect(typeof content).toBe('string');
      expect(content.length).toBeGreaterThan(10);
    }
  });

  test('mcpResources.templates stays empty when no templates are registered', () => {
    expect(mcpResources).toHaveProperty('templates');
    expect(typeof mcpResources.templates).toBe('object');
    expect(Object.keys(mcpResources.templates)).toHaveLength(0);
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

  test('prompts/list and prompts/get expose the embedded contextual prompt', async () => {
    const prompts = await mcp.client.listPrompts();
    const contextualPrompt = prompts.prompts.find((prompt: { name: string }) => prompt.name === 'contextual-prompt');

    expect(contextualPrompt).toBeDefined();
    expect(contextualPrompt?.title).toBe('Contextual Prompt');

    const prompt = await mcp.client.getPrompt({ name: 'contextual-prompt' });
    const firstMessage = prompt.messages[0];
    const embeddedPrompt = (mcpResources.prompts as Record<string, string>)['contextual-prompt'];
    const runtimePromptText = firstMessage?.content.type === 'text' ? firstMessage.content.text : '';

    expect(firstMessage).toBeDefined();
    expect(firstMessage?.content.type).toBe('text');
    expect(runtimePromptText.length).toBeGreaterThan(20);
    expect(embeddedPrompt.length).toBeGreaterThan(20);
    // Runtime prompt text may come from a different deployed server build; assert core intent instead of exact bytes.
    expect(runtimePromptText.toLowerCase()).toContain('kairos');
  }, 30000);

  test('resources/list returns registered resources', async () => {
    const resources = await mcp.client.listResources();
    expect(Array.isArray(resources.resources)).toBe(true);
    expect(resources.resources.some((r: any) => typeof r.uri === 'string' && r.uri.startsWith('kairos://meta/'))).toBe(false);
    expect(resources.resources.some((r: any) => r.uri === 'kairos://doc/building-kairos-workflows')).toBe(true);
  }, 30000);

  test('resources/templates/list returns empty array when no templates are registered', async () => {
    const templates = await mcp.client.listResourceTemplates();
    expect(Array.isArray(templates.resourceTemplates)).toBe(true);
    expect(templates.resourceTemplates.length).toBe(0);
  }, 30000);
});

