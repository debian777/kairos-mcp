/**
 * Personal → group: `tune` with `space` moves the adapter (same adapter id).
 * MCP, REST API, CLI (--space move-only).
 */

import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
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
import {
  BASE_URL,
  CLI_PATH,
  execAsync,
  setupCliConfigWithLogin,
  setupServerCheck
} from './cli-commands-shared.js';

const API_BASE = `${getTestAuthBaseUrl()}/api`;

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
    const why = adapterSpaceSkipReason(bundle, serverOk);
    if (why || !bundle) {
      console.warn(`[adapter-space-move] skip MCP move: ${why}`);
      return;
    }
    expect.hasAssertions();
    const { mcp, groupSpaceName, loadSpacesViaMcp } = bundle;
    const title = `SpaceMoveMCP ${Date.now()}`;
    const md = buildSpaceMoveMarkdown(title);

    const trainCall = {
      name: 'train',
      arguments: { markdown_doc: md, llm_model_id: 'test-space-move-mcp', space: 'personal', force_update: true }
    };
    const trainRes = await mcp.client.callTool(trainCall);
    const trained = parseMcpJson(trainRes, 'train-move-mcp');
    withRawOnFail({ call: trainCall, result: trainRes }, () => {
      expect(trained.status).toBe('stored');
      expect(Array.isArray(trained.items)).toBe(true);
      expect(trained.items.length).toBeGreaterThan(0);
    });
    const adapterUri = trained.items[0].adapter_uri as string;
    const sourceId = parseAdapterUuidFromUri(adapterUri);

    await sleepMs(3500);
    let spaces = await loadSpacesViaMcp();
    let locBefore = locationsForAdapterTitle(spaces, title);
    withRawOnFail({ call: trainCall, result: trainRes }, () => {
      expect(locBefore.some((l) => l.type === 'personal')).toBe(true);
    });

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

    await sleepMs(2000);
    spaces = await loadSpacesViaMcp();
    const locAfter = locationsForAdapterTitle(spaces, title);
    withRawOnFail({ call: tuneCall, result: tuneRes }, () => {
      expect(locAfter.some((l) => l.type === 'group')).toBe(true);
      expect(locAfter.some((l) => l.type === 'personal')).toBe(false);
      const groupHit = locAfter.find((l) => l.type === 'group');
      expect(groupHit?.adapterId.toLowerCase()).toBe(sourceId);
    });
  }, 120000);

  test('API: POST /api/tune with space moves personal adapter into group', async () => {
    const why = adapterSpaceSkipReason(bundle, serverOk);
    if (why || !bundle) {
      console.warn(`[adapter-space-move] skip API move: ${why}`);
      return;
    }
    expect.hasAssertions();
    const { groupSpaceName, loadSpacesViaMcp } = bundle;
    const title = `SpaceMoveAPI ${Date.now()}`;
    const md = buildSpaceMoveMarkdown(title);

    const trainBody = {
      markdown_doc: md,
      llm_model_id: 'test-space-move-api',
      space: 'personal',
      force_update: true
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
    const sourceId = parseAdapterUuidFromUri(adapterUri);

    await sleepMs(3500);
    let spaces = await loadSpacesViaMcp();
    expect(locationsForAdapterTitle(spaces, title).some((l) => l.type === 'personal')).toBe(true);

    const tu = await apiFetch('/tune', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris: [adapterUri], space: groupSpaceName })
    });
    expect(tu.status).toBe(200);
    const tuned = (await tu.json()) as { total_updated: number };
    expect(tuned.total_updated).toBeGreaterThanOrEqual(1);

    await sleepMs(2000);
    spaces = await loadSpacesViaMcp();
    const locAfter = locationsForAdapterTitle(spaces, title);
    expect(locAfter.some((l) => l.type === 'group')).toBe(true);
    expect(locAfter.some((l) => l.type === 'personal')).toBe(false);
    expect(locAfter.find((l) => l.type === 'group')?.adapterId.toLowerCase()).toBe(sourceId);
  }, 120000);

  test('CLI: tune --space moves personal adapter into group', async () => {
    const why = adapterSpaceSkipReason(bundle, serverOk);
    if (!cliOk || why || !bundle) {
      console.warn(`[adapter-space-move] skip CLI move: ${why ?? 'CLI not logged in'}`);
      return;
    }
    expect.hasAssertions();
    const { groupSpaceName, loadSpacesViaMcp } = bundle;
    const title = `SpaceMoveCLI ${Date.now()}`;
    const dir = mkdtempSync(join(tmpdir(), 'kairos-space-cli-'));
    const mdPath = join(dir, 'proto.md');
    try {
      writeFileSync(mdPath, buildSpaceMoveMarkdown(title), 'utf8');
      const mint = await execAsync(
        `node ${CLI_PATH} train --url ${BASE_URL} --force --model test-space-move-cli "${mdPath}"`,
        { timeout: 60000 }
      );
      expect(mint.stderr).toBe('');
      const minted = JSON.parse(mint.stdout) as { items: Array<{ adapter_uri: string }> };
      const adapterUri = minted.items[0]!.adapter_uri;
      const sourceId = parseAdapterUuidFromUri(adapterUri);

      await sleepMs(3500);
      let spaces = await loadSpacesViaMcp();
      expect(locationsForAdapterTitle(spaces, title).some((l) => l.type === 'personal')).toBe(true);

      const tuneOut = await execAsync(
        `node ${CLI_PATH} tune --url ${BASE_URL} --space ${JSON.stringify(groupSpaceName!)} ${JSON.stringify(adapterUri)}`,
        { timeout: 60000 }
      );
      expect(tuneOut.stderr).toBe('');
      const tuned = JSON.parse(tuneOut.stdout) as { total_updated: number };
      expect(tuned.total_updated).toBeGreaterThanOrEqual(1);

      await sleepMs(2000);
      spaces = await loadSpacesViaMcp();
      const locAfter = locationsForAdapterTitle(spaces, title);
      expect(locAfter.some((l) => l.type === 'group')).toBe(true);
      expect(locAfter.some((l) => l.type === 'personal')).toBe(false);
      expect(locAfter.find((l) => l.type === 'group')?.adapterId.toLowerCase()).toBe(sourceId);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 180000);
});
