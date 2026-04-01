import { createMcpConnection } from '../utils/mcp-client-utils.js';
import { parseMcpJson, withRawOnFail } from '../utils/expect-with-raw.js';
import { getTestSpaceId } from '../utils/auth-headers.js';

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
  let createdAdapterUris: string[] = [];

  function activateArgs(query: string): { query: string; space_id?: string } {
    const args: { query: string; space_id?: string } = { query };
    const spaceId = getTestSpaceId();
    if (spaceId) args.space_id = spaceId;
    return args;
  }

  function rememberCreatedAdapters(parsed: { items?: Array<{ adapter_uri?: string }> }) {
    for (const item of parsed.items ?? []) {
      if (item.adapter_uri) createdAdapterUris.push(item.adapter_uri);
    }
  }

  beforeAll(async () => {
    mcpConnection = await createMcpConnection();
  }, 30000);

  afterEach(async () => {
    const uris = [...new Set(createdAdapterUris)];
    createdAdapterUris = [];
    if (!mcpConnection || uris.length === 0) return;

    const deleteResult = await mcpConnection.client.callTool({
      name: 'delete',
      arguments: { uris }
    });
    parseMcpJson(deleteResult, 'activate precision cleanup');
  });

  afterAll(async () => {
    if (mcpConnection) {
      await mcpConnection.close();
    }
  });

  test('prefers the adapter whose activation patterns match the query', async () => {
    const ts = Date.now();
    const targetTitle = `Alpha Adapter ${ts}`;
    const distractorTitle = `Beta Adapter ${ts}`;
    const uniqueQuery = `rotate database credentials token-${ts}`;

    const trainTarget = await mcpConnection.client.callTool({
      name: 'train',
      arguments: {
        markdown_doc: buildAdapterMarkdown(targetTitle, [
          uniqueQuery,
          `rotate postgres password token-${ts}`
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
    const targetPayload = parseMcpJson(trainTarget, 'activate precision target') as {
      status: string;
      items?: Array<{ adapter_uri?: string }>;
    };
    const distractorPayload = parseMcpJson(trainDistractor, 'activate precision distractor') as {
      status: string;
      items?: Array<{ adapter_uri?: string }>;
    };
    rememberCreatedAdapters(targetPayload);
    rememberCreatedAdapters(distractorPayload);
    expect(targetPayload.status).toBe('stored');
    expect(distractorPayload.status).toBe('stored');

    const call = {
      name: 'activate',
      arguments: activateArgs(uniqueQuery)
    };
    const result = await mcpConnection.client.callTool(call);
    const parsed = parseMcpJson(result, 'activate precision search');

    withRawOnFail({ call, result }, () => {
      const matchChoices = (parsed.choices as Array<Record<string, unknown>>).filter(
        (choice) => choice.role === 'match'
      );
      expect(matchChoices.length).toBeGreaterThan(0);
      expect(matchChoices[0]?.label).toBe(targetTitle);
      expect(matchChoices[0]?.activation_patterns).toContain(uniqueQuery);
    });
  }, 30000);
});
