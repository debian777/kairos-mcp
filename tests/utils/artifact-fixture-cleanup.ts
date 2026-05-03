import { getAuthHeaders, getTestAuthBaseUrl } from './auth-headers.js';
import type { McpClientConnection } from './mcp-client-utils.js';
import { BASE_URL, CLI_PATH, execAsync } from '../integration/cli-commands-shared.js';

const API_BASE = `${getTestAuthBaseUrl()}/api`;
const UUID_RE = /^[0-9a-f-]{36}$/i;

function uniqUris(input: string[]): string[] {
  return [...new Set(input.map((v) => v.trim()).filter((v) => v.length > 0))];
}

function toLayerUriFromArtifactUri(uri: string): string {
  if (uri.startsWith('kairos://layer/')) return uri;
  if (uri.startsWith('kairos://artifact/')) {
    const id = uri.slice('kairos://artifact/'.length).trim();
    return UUID_RE.test(id) ? `kairos://layer/${id}` : '';
  }
  return uri;
}

function cleanupUris(adapterUri: string, artifactUris: string[]): string[] {
  const layers = artifactUris.map(toLayerUriFromArtifactUri).filter((v) => v.length > 0);
  return uniqUris([adapterUri, ...layers]);
}

export async function cleanupViaApi(adapterUri: string, artifactUris: string[]): Promise<void> {
  const uris = cleanupUris(adapterUri, artifactUris);
  const res = await fetch(`${API_BASE}/delete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({ uris })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API cleanup failed (${res.status}): ${body}`);
  }
}

export async function cleanupViaMcp(
  mcp: Pick<McpClientConnection, 'client'>,
  adapterUri: string,
  artifactUris: string[]
): Promise<void> {
  const uris = cleanupUris(adapterUri, artifactUris);
  await mcp.client.callTool({ name: 'delete', arguments: { uris } });
}

export async function cleanupViaCli(
  adapterUri: string,
  artifactUris: string[],
  runExec: typeof execAsync = execAsync
): Promise<void> {
  const uris = cleanupUris(adapterUri, artifactUris);
  const cmd = `node ${CLI_PATH} delete --url ${BASE_URL} ${uris.join(' ')}`;
  await runExec(cmd);
}
