import { cleanupViaApi, cleanupViaCli, cleanupViaMcp } from '../utils/artifact-fixture-cleanup.js';

describe('artifact-fixture-cleanup', () => {
  const adapterUri = 'kairos://adapter/11111111-1111-1111-1111-111111111111';
  const artifactUris = [
    'kairos://artifact/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'kairos://layer/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  ];

  it('calls API delete with adapter plus normalized artifact layer URIs', async () => {
    const originalFetch = global.fetch;
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response('{}', { status: 200 });
    }) as typeof fetch;

    try {
      await cleanupViaApi(adapterUri, artifactUris);
      expect(calls).toHaveLength(1);
      const parsed = JSON.parse(String(calls[0]!.init?.body)) as { uris: string[] };
      expect(parsed.uris).toEqual([
        adapterUri,
        'kairos://layer/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'kairos://layer/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
      ]);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('calls MCP delete tool with normalized URIs', async () => {
    const calls: unknown[] = [];
    const callTool = async (args: unknown) => {
      calls.push(args);
      return { content: [] };
    };
    const mcp = { client: { callTool } } as Parameters<typeof cleanupViaMcp>[0];
    await cleanupViaMcp(mcp, adapterUri, artifactUris);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      name: 'delete',
      arguments: {
        uris: [
          adapterUri,
          'kairos://layer/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          'kairos://layer/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
        ]
      }
    });
  });

  it('builds CLI delete command with all cleanup URIs', async () => {
    const execCalls: string[] = [];
    await cleanupViaCli(adapterUri, artifactUris, async (cmd: string) => {
      execCalls.push(cmd);
      return { stdout: '', stderr: '' };
    });
    expect(execCalls).toHaveLength(1);
    expect(execCalls[0]).toContain(' delete ');
    expect(execCalls[0]).toContain(adapterUri);
    expect(execCalls[0]).toContain('kairos://layer/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  });
});
