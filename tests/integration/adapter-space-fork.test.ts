/**
 * Group → personal: `train` with `source_adapter_uri` + `space: personal` copies (new adapter id).
 * MCP, REST API, CLI (--source-adapter-uri).
 */

import { parseMcpJson, withRawOnFail } from '../utils/expect-with-raw.js';
import { getAuthHeaders, getTestAuthBaseUrl } from '../utils/auth-headers.js';
import {
  buildSpaceMoveMarkdown,
  locationsForAdapterTitle,
  parseAdapterUuidFromUri,
  sleepMs
} from '../utils/adapter-space-test-helpers.js';
import {
  adapterSpaceSkipReason,
  openAdapterSpaceMcpBundle
} from './utils/adapter-space-mcp-context.js';
import { BASE_URL, CLI_PATH, execAsync, setupCliConfigWithLogin, setupServerCheck } from './cli-commands-shared.js';

const API_BASE = `${getTestAuthBaseUrl()}/api`;

function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...getAuthHeaders(), ...(init?.headers as Record<string, string>) }
  });
}

describe('Adapter fork copy (group → personal)', () => {
  let bundle: Awaited<ReturnType<typeof openAdapterSpaceMcpBundle>> = null;
  let serverOk = false;
  let cliOk = false;

  beforeAll(async () => {
    serverOk = await setupServerCheck();
    cliOk = await setupCliConfigWithLogin();
    bundle = await openAdapterSpaceMcpBundle();
  }, 120000);

  afterAll(async () => {
    if (bundle?.mcp) await bundle.mcp.close();
  });

  test('MCP: train fork copies group adapter into personal (group original unchanged)', async () => {
    const why = adapterSpaceSkipReason(bundle, serverOk);
    if (why || !bundle) {
      console.warn(`[adapter-space-fork] skip MCP fork: ${why}`);
      return;
    }
    expect.hasAssertions();
    const { mcp, groupSpaceName, loadSpacesViaMcp } = bundle;
    const title = `SpaceForkMCP ${Date.now()}`;
    const md = buildSpaceMoveMarkdown(title);

    const trainGroupCall = {
      name: 'train',
      arguments: {
        markdown_doc: md,
        llm_model_id: 'test-space-fork-mcp',
        space: groupSpaceName,
        force_update: true
      }
    };
    const trainGroupRes = await mcp.client.callTool(trainGroupCall);
    const stored = parseMcpJson(trainGroupRes, 'train-fork-mcp-group');
    withRawOnFail({ call: trainGroupCall, result: trainGroupRes }, () => {
      expect(stored.status).toBe('stored');
    });
    const sourceUri = stored.items[0].adapter_uri as string;
    const sourceId = parseAdapterUuidFromUri(sourceUri);

    await sleepMs(3500);
    let spaces = await loadSpacesViaMcp();
    let loc = locationsForAdapterTitle(spaces, title);
    withRawOnFail({ call: trainGroupCall, result: trainGroupRes }, () => {
      expect(loc.filter((l) => l.type === 'group').length).toBe(1);
      expect(loc.some((l) => l.type === 'personal')).toBe(false);
    });

    const forkCall = {
      name: 'train',
      arguments: {
        llm_model_id: 'test-space-fork-mcp-copy',
        source_adapter_uri: sourceUri,
        space: 'personal',
        force_update: true
      }
    };
    const forkRes = await mcp.client.callTool(forkCall);
    const forked = parseMcpJson(forkRes, 'train-fork-mcp-personal');
    withRawOnFail({ call: forkCall, result: forkRes }, () => {
      expect(forked.status).toBe('stored');
    });
    const copyUri = forked.items[0].adapter_uri as string;
    const copyId = parseAdapterUuidFromUri(copyUri);
    expect(copyId).not.toBe(sourceId);

    await sleepMs(3500);
    spaces = await loadSpacesViaMcp();
    loc = locationsForAdapterTitle(spaces, title);
    withRawOnFail({ call: forkCall, result: forkRes }, () => {
      expect(loc.filter((l) => l.type === 'group').length).toBe(1);
      expect(loc.filter((l) => l.type === 'personal').length).toBe(1);
      expect(loc.find((l) => l.type === 'group')?.adapterId.toLowerCase()).toBe(sourceId);
      expect(loc.find((l) => l.type === 'personal')?.adapterId.toLowerCase()).toBe(copyId);
    });
  }, 120000);

  test('API: POST /api/train fork copies group adapter into personal', async () => {
    const why = adapterSpaceSkipReason(bundle, serverOk);
    if (why || !bundle) {
      console.warn(`[adapter-space-fork] skip API fork: ${why}`);
      return;
    }
    expect.hasAssertions();
    const { groupSpaceName, loadSpacesViaMcp } = bundle;
    const title = `SpaceForkAPI ${Date.now()}`;
    const md = buildSpaceMoveMarkdown(title);

    const tr = await apiFetch('/train', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        markdown_doc: md,
        llm_model_id: 'test-space-fork-api-g',
        space: groupSpaceName,
        force_update: true
      })
    });
    expect(tr.status).toBe(200);
    const stored = (await tr.json()) as { items: Array<{ adapter_uri: string }> };
    const sourceUri = stored.items[0]!.adapter_uri;
    const sourceId = parseAdapterUuidFromUri(sourceUri);

    await sleepMs(3500);

    const fr = await apiFetch('/train', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        llm_model_id: 'test-space-fork-api-p',
        source_adapter_uri: sourceUri,
        space: 'personal',
        force_update: true
      })
    });
    expect(fr.status).toBe(200);
    const forked = (await fr.json()) as { items: Array<{ adapter_uri: string }> };
    const copyId = parseAdapterUuidFromUri(forked.items[0]!.adapter_uri);
    expect(copyId).not.toBe(sourceId);

    await sleepMs(3500);
    const spaces = await loadSpacesViaMcp();
    const loc = locationsForAdapterTitle(spaces, title);
    expect(loc.filter((l) => l.type === 'group').length).toBe(1);
    expect(loc.filter((l) => l.type === 'personal').length).toBe(1);
    expect(loc.find((l) => l.type === 'group')?.adapterId.toLowerCase()).toBe(sourceId);
    expect(loc.find((l) => l.type === 'personal')?.adapterId.toLowerCase()).toBe(copyId);
  }, 120000);

  test('CLI: train --source-adapter-uri copies group adapter into personal', async () => {
    const why = adapterSpaceSkipReason(bundle, serverOk);
    if (!cliOk || why || !bundle) {
      console.warn(`[adapter-space-fork] skip CLI fork: ${why ?? 'CLI not logged in'}`);
      return;
    }
    expect.hasAssertions();
    const { groupSpaceName, loadSpacesViaMcp } = bundle;
    const title = `SpaceForkCLI ${Date.now()}`;
    const md = buildSpaceMoveMarkdown(title);

    const tr = await apiFetch('/train', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        markdown_doc: md,
        llm_model_id: 'test-space-fork-cli-g',
        space: groupSpaceName,
        force_update: true
      })
    });
    expect(tr.status).toBe(200);
    const stored = (await tr.json()) as { items: Array<{ adapter_uri: string }> };
    const sourceUri = stored.items[0]!.adapter_uri;
    const sourceId = parseAdapterUuidFromUri(sourceUri);

    await sleepMs(3500);

    const forkOut = await execAsync(
      `node ${CLI_PATH} train --url ${BASE_URL} --model test-space-fork-cli-p --force --source-adapter-uri "${sourceUri}" --space personal`,
      { timeout: 60000 }
    );
    expect(forkOut.stderr).toBe('');
    const forked = JSON.parse(forkOut.stdout) as { items: Array<{ adapter_uri: string }> };
    const copyId = parseAdapterUuidFromUri(forked.items[0]!.adapter_uri);
    expect(copyId).not.toBe(sourceId);

    await sleepMs(3500);
    const spaces = await loadSpacesViaMcp();
    const loc = locationsForAdapterTitle(spaces, title);
    expect(loc.filter((l) => l.type === 'group').length).toBe(1);
    expect(loc.filter((l) => l.type === 'personal').length).toBe(1);
    expect(loc.find((l) => l.type === 'group')?.adapterId.toLowerCase()).toBe(sourceId);
    expect(loc.find((l) => l.type === 'personal')?.adapterId.toLowerCase()).toBe(copyId);
  }, 180000);
});
