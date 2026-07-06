/**
 * Group → personal: `train` with `source_adapter_uri` + `space: personal` copies (new adapter id).
 * MCP, REST API, CLI (--source-adapter-uri).
 */

import { parseMcpJson, withRawOnFail } from '../utils/expect-with-raw.js';
import { getAuthHeaders, getTestAuthBaseUrl, isHttpTransport } from '../utils/auth-headers.js';
import {
  buildSpaceMoveMarkdown,
  locationsForAdapterTitle,
  type SpaceRow,
  sleepMs
} from '../utils/adapter-space-test-helpers.js';
import {
  assertGroupSpacesWhenAuth,
  openAdapterSpaceMcpBundle
} from './utils/adapter-space-mcp-context.js';
import { hasAuthToken, serverRequiresAuth } from '../utils/auth-headers.js';
import { BASE_URL, CLI_PATH, execAsync, setupCliConfigWithLogin, setupServerCheck } from './cli-commands-shared.js';
import { MOCK_REVIEW_EVIDENCE } from '../utils/mock-review-evidence.js';

const API_BASE = `${getTestAuthBaseUrl()}/api`;
const _d = isHttpTransport() ? describe : describe.skip;

function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...getAuthHeaders(), ...(init?.headers as Record<string, string>) }
  });
}

type AdapterLoc = ReturnType<typeof locationsForAdapterTitle>;

async function waitForSpaceLocations(
  loadSpacesViaMcp: () => Promise<SpaceRow[]>,
  title: string,
  predicate: (loc: AdapterLoc) => boolean,
  timeoutMs = 30000
): Promise<AdapterLoc> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const spaces = await loadSpacesViaMcp();
    const loc = locationsForAdapterTitle(spaces, title);
    if (predicate(loc)) return loc;
    await sleepMs(1000);
  }
  const spaces = await loadSpacesViaMcp();
  return locationsForAdapterTitle(spaces, title);
}

_d('Adapter fork copy (group → personal)', () => {
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
    if (!serverOk) {
      console.warn('[adapter-space-fork] skip MCP fork: server unavailable');
      return;
    }
    if (!serverRequiresAuth() || !hasAuthToken()) {
      console.warn('[adapter-space-fork] skip MCP fork: auth disabled or no token');
      return;
    }
    assertGroupSpacesWhenAuth(bundle, serverOk);
    expect.hasAssertions();
    const { mcp, groupSpaceName, loadSpacesViaMcp } = bundle;
    const title = `SpaceForkMCP ${Date.now()}`;
    const md = buildSpaceMoveMarkdown(title);

    const trainGroupCall = {
      name: 'train',
      arguments: {
        content: md,
        llm_model_id: 'test-space-fork-mcp',
        space: groupSpaceName,
        force_update: true,
        review_evidence: MOCK_REVIEW_EVIDENCE
      }
    };
    const trainGroupRes = await mcp.client.callTool(trainGroupCall);
    const stored = parseMcpJson(trainGroupRes, 'train-fork-mcp-group');
    withRawOnFail({ call: trainGroupCall, result: trainGroupRes }, () => {
      expect(stored.status).toBe('stored');
    });
    const sourceUri = stored.items[0].adapter_uri as string;

    await sleepMs(5000);
    let spaces = await loadSpacesViaMcp();
    let loc = locationsForAdapterTitle(spaces, title);
    withRawOnFail({ call: trainGroupCall, result: trainGroupRes }, () => {
      expect(loc.filter((l) => l.type === 'group').length).toBe(1);
      expect(loc.some((l) => l.type === 'personal')).toBe(false);
    });
    const sourceId = loc.find((l) => l.type === 'group')!.adapterId.toLowerCase();

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
    loc = await waitForSpaceLocations(
      loadSpacesViaMcp,
      title,
      (rows) => rows.some((l) => l.type === 'group') && rows.some((l) => l.type === 'personal')
    );
    const copyId = loc.find((l) => l.type === 'personal')?.adapterId.toLowerCase();
    withRawOnFail({ call: forkCall, result: forkRes, loc }, () => {
      expect(copyId).toBeTruthy();
    });
    expect(copyId).not.toBe(sourceId);
    withRawOnFail({ call: forkCall, result: forkRes }, () => {
      expect(loc.filter((l) => l.type === 'group').length).toBe(1);
      expect(loc.filter((l) => l.type === 'personal').length).toBe(1);
      expect(loc.find((l) => l.type === 'group')?.adapterId.toLowerCase()).toBe(sourceId);
      expect(loc.find((l) => l.type === 'personal')?.adapterId.toLowerCase()).toBe(copyId);
    });
  }, 120000);

  test('API: POST /api/train fork copies group adapter into personal', async () => {
    if (!serverOk) {
      console.warn('[adapter-space-fork] skip API fork: server unavailable');
      return;
    }
    if (!serverRequiresAuth() || !hasAuthToken()) {
      console.warn('[adapter-space-fork] skip API fork: auth disabled or no token');
      return;
    }
    assertGroupSpacesWhenAuth(bundle, serverOk);
    expect.hasAssertions();
    const { groupSpaceName, loadSpacesViaMcp } = bundle;
    const title = `SpaceForkAPI ${Date.now()}`;
    const md = buildSpaceMoveMarkdown(title);

    const tr = await apiFetch('/train', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: md,
        llm_model_id: 'test-space-fork-api-g',
        space: groupSpaceName,
        force_update: true,
        review_evidence: MOCK_REVIEW_EVIDENCE
      })
    });
    expect(tr.status).toBe(200);
    const stored = (await tr.json()) as { items: Array<{ adapter_uri: string }> };
    const sourceUri = stored.items[0]!.adapter_uri;

    await sleepMs(5000);

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
    await fr.json();
    const loc = await waitForSpaceLocations(
      loadSpacesViaMcp,
      title,
      (rows) => rows.some((l) => l.type === 'group') && rows.some((l) => l.type === 'personal')
    );
    const sourceId = loc.find((l) => l.type === 'group')!.adapterId.toLowerCase();
    const copyId = loc.find((l) => l.type === 'personal')?.adapterId.toLowerCase();
    withRawOnFail({ loc }, () => {
      expect(copyId).toBeTruthy();
    });
    expect(copyId).not.toBe(sourceId);
    expect(loc.filter((l) => l.type === 'group').length).toBe(1);
    expect(loc.filter((l) => l.type === 'personal').length).toBe(1);
    expect(loc.find((l) => l.type === 'group')?.adapterId.toLowerCase()).toBe(sourceId);
    expect(loc.find((l) => l.type === 'personal')?.adapterId.toLowerCase()).toBe(copyId);
  }, 120000);

  test('CLI: train --source-adapter-uri copies group adapter into personal', async () => {
    if (!serverOk) {
      console.warn('[adapter-space-fork] skip CLI fork: server unavailable');
      return;
    }
    if (!serverRequiresAuth() || !hasAuthToken()) {
      console.warn('[adapter-space-fork] skip CLI fork: auth disabled or no token');
      return;
    }
    if (!cliOk) {
      console.warn('[adapter-space-fork] skip CLI fork: CLI not logged in');
      return;
    }
    assertGroupSpacesWhenAuth(bundle, serverOk);
    expect.hasAssertions();
    const { groupSpaceName, loadSpacesViaMcp } = bundle;
    const title = `SpaceForkCLI ${Date.now()}`;
    const md = buildSpaceMoveMarkdown(title);

    const tr = await apiFetch('/train', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: md,
        llm_model_id: 'test-space-fork-cli-g',
        space: groupSpaceName,
        force_update: true,
        review_evidence: MOCK_REVIEW_EVIDENCE
      })
    });
    expect(tr.status).toBe(200);
    const stored = (await tr.json()) as { items: Array<{ adapter_uri: string }> };
    const sourceUri = stored.items[0]!.adapter_uri;

    await sleepMs(5000);

    const forkOut = await execAsync(
      `node ${CLI_PATH} train --url ${BASE_URL} --model test-space-fork-cli-p --force --source-adapter-uri "${sourceUri}" --space personal`,
      { timeout: 60000 }
    );
    expect(forkOut.stderr).toBe('');
    JSON.parse(forkOut.stdout);
    const loc = await waitForSpaceLocations(
      loadSpacesViaMcp,
      title,
      (rows) => rows.some((l) => l.type === 'group') && rows.some((l) => l.type === 'personal'),
      90000
    );
    const sourceId = loc.find((l) => l.type === 'group')!.adapterId.toLowerCase();
    const copyId = loc.find((l) => l.type === 'personal')?.adapterId.toLowerCase();
    withRawOnFail({ loc }, () => {
      expect(copyId).toBeTruthy();
    });
    expect(copyId).not.toBe(sourceId);
    expect(loc.filter((l) => l.type === 'group').length).toBe(1);
    expect(loc.filter((l) => l.type === 'personal').length).toBe(1);
    expect(loc.find((l) => l.type === 'group')?.adapterId.toLowerCase()).toBe(sourceId);
    expect(loc.find((l) => l.type === 'personal')?.adapterId.toLowerCase()).toBe(copyId);
  }, 180000);
});
