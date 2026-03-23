import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { parseMcpJson, withRawOnFail } from '../utils/expect-with-raw.js';

function buildAdapterMarkdown(title: string, activationPatterns: string[]): string {
  return [
    `# ${title}`,
    '',
    '## Activation Patterns',
    '',
    ...activationPatterns.map((pattern) => `- ${pattern}`),
    '',
    '## Step One',
    'Perform the requested maintenance task.',
    '',
    '```json',
    '{"contract":{"type":"comment","comment":{"min_length":20},"required":true}}',
    '```',
    '',
    '## Reward Signal',
    'Only after all steps.'
  ].join('\n');
}

describe('activate precision', () => {
  let mcpConnection: Awaited<ReturnType<typeof createMcpConnection>>;

  beforeAll(async () => {
    mcpConnection = await createMcpConnection();
  }, 30000);

  afterAll(async () => {
    if (mcpConnection) {
      await mcpConnection.close();
    }
  });

  test('prefers the adapter whose activation patterns match the query', async () => {
    const ts = Date.now();
    const targetTitle = `Alpha Adapter ${ts}`;
    const distractorTitle = `Beta Adapter ${ts}`;

    const trainTarget = await mcpConnection.client.callTool({
      name: 'train',
      arguments: {
        markdown_doc: buildAdapterMarkdown(targetTitle, [
          'rotate database credentials',
          'rotate postgres password'
        ]),
        llm_model_id: 'test-activate-precision',
        force_update: true
      }
    });
    const trainDistractor = await mcpConnection.client.callTool({
      name: 'train',
      arguments: {
        markdown_doc: buildAdapterMarkdown(distractorTitle, [
          'restart background worker',
          'drain a queue consumer'
        ]),
        llm_model_id: 'test-activate-precision',
        force_update: true
      }
    });
    expect(parseMcpJson(trainTarget, 'activate precision target').status).toBe('stored');
    expect(parseMcpJson(trainDistractor, 'activate precision distractor').status).toBe('stored');

    const call = {
      name: 'activate',
      arguments: { query: 'rotate database credentials' }
    };
    const result = await mcpConnection.client.callTool(call);
    const parsed = parseMcpJson(result, 'activate precision search');

    withRawOnFail({ call, result }, () => {
      const matchChoices = (parsed.choices as Array<Record<string, unknown>>).filter(
        (choice) => choice.role === 'match'
      );
      expect(matchChoices.length).toBeGreaterThan(0);
      expect(matchChoices[0]?.label).toBe(targetTitle);
      expect(matchChoices[0]?.activation_patterns).toContain('rotate database credentials');
    });
  }, 30000);
});
