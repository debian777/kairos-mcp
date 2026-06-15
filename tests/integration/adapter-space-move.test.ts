/**
 * Personal → group: `tune` with `space` moves the adapter (same adapter id).
 * MCP, REST API, CLI (--space move-only).
 */

import { parseMcpJson, withRawOnFail } from '../utils/expect-with-raw.js';
import { getAuthHeaders, getTestAuthBaseUrl } from '../utils/auth-headers.js';
import {
  buildSpaceMoveMarkdown,
  locationsForAdapterTitle,
  sleepMs,
  type SpaceRow
} from '../utils/adapter-space-test-helpers.js';
import {
  assertGroupSpacesWhenAuth,
  openAdapterSpaceMcpBundle
} from './utils/adapter-space-mcp-context.js';
import { hasAuthToken, serverRequiresAuth } from '../utils/auth-headers.js';
import { MOCK_REVIEW_EVIDENCE } from '../utils/mock-review-evidence.js';
import {
  BASE_URL,
  CLI_PATH,
  execAsync,
  setupCliConfigWithLogin,
  setupServerCheck
} from './cli-commands-shared.js';

const API_BASE = `${getTestAuthBaseUrl()}/api`;

type AdapterLoc = ReturnType<typeof locationsForAdapterTitle>;

async function waitForSpaceLocations(
  loadSpacesViaMcp: () => Promise<SpaceRow[]>,
  title: string,
  predicate: (loc: AdapterLoc) => boolean,
  timeoutMs = 60000
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

function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...getAuthHeaders(), ...(init?.headers as Record<string, string>) }
  });
}

describe('Adapter space move (personal → group)', () => {
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

  test('MCP: tune(space) moves personal adapter into group', async () => {
    if (!serverOk) {
      console.warn('[adapter-space-move] skip MCP move: server unavailable');
      return;
    }
    if (!serverRequiresAuth() || !hasAuthToken()) {
      console.warn('[adapter-space-move] skip MCP move: auth disabled or no token');
      return;
    }
    assertGroupSpacesWhenAuth(bundle, serverOk);
    expect.hasAssertions();
    const { mcp, groupSpaceName, loadSpacesViaMcp } = bundle;
    const title = `SpaceMoveMCP ${Date.now()}`;
    const md = buildSpaceMoveMarkdown(title);

    const trainCall = {
      name: 'train',
      arguments: { content: md, llm_model_id: 'test-space-move-mcp', space: 'personal', force_update: true,
        review_evidence: MOCK_REVIEW_EVIDENCE
      }
    };
    const trainRes = await mcp.client.callTool(trainCall);
    const trained = parseMcpJson(trainRes, 'train-move-mcp');
    withRawOnFail({ call: trainCall, result: trainRes }, () => {
      expect(trained.status).toBe('stored');
      expect(Array.isArray(trained.items)).toBe(true);
      expect(trained.items.length).toBeGreaterThan(0);
    });
    const adapterUri = trained.items[0].adapter_uri as string;

    const locBefore = await waitForSpaceLocations(
      loadSpacesViaMcp,
      title,
      (loc) => loc.some((l) => l.type === 'personal'),
      90000
    );
    withRawOnFail({ call: trainCall, result: trainRes, locBefore }, () => {
      expect(locBefore.some((l) => l.type === 'personal')).toBe(true);
    });
    const sourceId = locBefore.find((l) => l.type === 'personal')!.adapterId.toLowerCase();

    const tuneCall = {
      name: 'tune',
      arguments: { uris: [adapterUri], space: groupSpaceName }
    };
    const tuneRes = await mcp.client.callTool(tuneCall);
    const tuned = parseMcpJson(tuneRes, 'tune-move-mcp');
    withRawOnFail({ call: tuneCall, result: tuneRes }, () => {
      expect(tuned.total_updated).toBeGreaterThanOrEqual(1);
      expect(tuned.results?.[0]?.status).toBe('updated');
    });

    const locAfter = await waitForSpaceLocations(
      loadSpacesViaMcp,
      title,
      (loc) => loc.some((l) => l.type === 'group') && !loc.some((l) => l.type === 'personal'),
      90000
    );
    withRawOnFail({ call: tuneCall, result: tuneRes, locAfter }, () => {
      expect(locAfter.some((l) => l.type === 'group')).toBe(true);
      expect(locAfter.some((l) => l.type === 'personal')).toBe(false);
      const groupHit = locAfter.find((l) => l.type === 'group');
      expect(groupHit?.adapterId.toLowerCase()).toBe(sourceId);
    });
  }, 120000);

  test('API: POST /api/tune with space moves personal adapter into group', async () => {
    if (!serverOk) {
      console.warn('[adapter-space-move] skip API move: server unavailable');
      return;
    }
    if (!serverRequiresAuth() || !hasAuthToken()) {
      console.warn('[adapter-space-move] skip API move: auth disabled or no token');
      return;
    }
    assertGroupSpacesWhenAuth(bundle, serverOk);
    expect.hasAssertions();
    const { groupSpaceName, loadSpacesViaMcp } = bundle;
    const title = `SpaceMoveAPI ${Date.now()}`;
    const md = buildSpaceMoveMarkdown(title);

    const trainBody = {
      content: md,
      llm_model_id: 'test-space-move-api',
      space: 'personal',
      force_update: true,
      review_evidence: MOCK_REVIEW_EVIDENCE
    };
    const tr = await apiFetch('/train', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trainBody)
    });
    expect(tr.status).toBe(200);
    const trained = (await tr.json()) as { status: string; items: Array<{ adapter_uri: string }> };
    expect(trained.status).toBe('stored');
    const adapterUri = trained.items[0]!.adapter_uri;

    const beforeLoc = await waitForSpaceLocations(
      loadSpacesViaMcp,
      title,
      (loc) => loc.some((l) => l.type === 'personal'),
      90000
    );
    expect(beforeLoc.some((l) => l.type === 'personal')).toBe(true);
    const sourceId = beforeLoc.find((l) => l.type === 'personal')!.adapterId.toLowerCase();

    const tu = await apiFetch('/tune', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris: [adapterUri], space: groupSpaceName })
    });
    expect(tu.status).toBe(200);
    const tuned = (await tu.json()) as { total_updated: number };
    expect(tuned.total_updated).toBeGreaterThanOrEqual(1);

    const locAfter = await waitForSpaceLocations(
      loadSpacesViaMcp,
      title,
      (loc) => loc.some((l) => l.type === 'group') && !loc.some((l) => l.type === 'personal'),
      90000
    );
    expect(locAfter.some((l) => l.type === 'group')).toBe(true);
    expect(locAfter.some((l) => l.type === 'personal')).toBe(false);
    expect(locAfter.find((l) => l.type === 'group')?.adapterId.toLowerCase()).toBe(sourceId);
  }, 120000);

  test('CLI: tune --space moves personal adapter into group', async () => {
    if (!serverOk) {
      console.warn('[adapter-space-move] skip CLI move: server unavailable');
      return;
    }
    if (!serverRequiresAuth() || !hasAuthToken()) {
      console.warn('[adapter-space-move] skip CLI move: auth disabled or no token');
      return;
    }
    if (!cliOk) {
      console.warn('[adapter-space-move] skip CLI move: CLI not logged in');
      return;
    }
    assertGroupSpacesWhenAuth(bundle, serverOk);
    expect.hasAssertions();
    const { mcp, groupSpaceName, loadSpacesViaMcp } = bundle;
    const title = `SpaceMoveCLI ${Date.now()}`;
    const trainCall = {
      name: 'train',
      arguments: { content: buildSpaceMoveMarkdown(title), llm_model_id: 'test-space-move-cli', space: 'personal', force_update: true,
        review_evidence: MOCK_REVIEW_EVIDENCE
      }
    };
    const trainRes = await mcp.client.callTool(trainCall);
    const trained = parseMcpJson(trainRes, 'train-move-cli');
    withRawOnFail({ call: trainCall, result: trainRes }, () => {
      expect(trained.status).toBe('stored');
      expect(Array.isArray(trained.items)).toBe(true);
      expect(trained.items.length).toBeGreaterThan(0);
    });
    const adapterUri = trained.items[0].adapter_uri as string;

    const beforeLoc = await waitForSpaceLocations(
      loadSpacesViaMcp,
      title,
      (loc) => loc.some((l) => l.type === 'personal'),
      90000
    );
    expect(beforeLoc.some((l) => l.type === 'personal')).toBe(true);
    const sourceId = beforeLoc.find((l) => l.type === 'personal')!.adapterId.toLowerCase();

    const tuneOut = await execAsync(
      `node ${CLI_PATH} tune --url ${BASE_URL} --space ${JSON.stringify(groupSpaceName!)} ${JSON.stringify(adapterUri)}`,
      { timeout: 60000 }
    );
    expect(tuneOut.stderr).toBe('');
    const tuned = JSON.parse(tuneOut.stdout) as { total_updated: number };
    expect(tuned.total_updated).toBeGreaterThanOrEqual(1);

    const locAfter = await waitForSpaceLocations(
      loadSpacesViaMcp,
      title,
      (loc) => loc.some((l) => l.type === 'group') && !loc.some((l) => l.type === 'personal'),
      90000
    );
    expect(locAfter.some((l) => l.type === 'group')).toBe(true);
    expect(locAfter.some((l) => l.type === 'personal')).toBe(false);
    expect(locAfter.find((l) => l.type === 'group')?.adapterId.toLowerCase()).toBe(sourceId);
  }, 180000);
});
