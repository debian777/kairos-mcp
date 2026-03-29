/**
 * Shared MCP + spaces snapshot for adapter space integration tests.
 */

import { createMcpConnection } from '../../utils/mcp-client-utils.js';
import { parseMcpJson } from '../../utils/expect-with-raw.js';
import { hasAuthToken, serverRequiresAuth } from '../../utils/auth-headers.js';
import type { SpaceRow } from '../../utils/adapter-space-test-helpers.js';

export type AdapterSpaceMcpBundle = {
  mcp: Awaited<ReturnType<typeof createMcpConnection>>;
  groupSpaceName: string | null;
  personalSpaceName: string | null;
  loadSpacesViaMcp: () => Promise<SpaceRow[]>;
  skipReason: (serverOk: boolean) => string | null;
};

export async function openAdapterSpaceMcpBundle(): Promise<AdapterSpaceMcpBundle | null> {
  if (!serverRequiresAuth() || !hasAuthToken()) return null;
  const mcp = await createMcpConnection();
  const spacesRes = await mcp.client.callTool({
    name: 'spaces',
    arguments: { include_adapter_titles: true }
  });
  const parsed = parseMcpJson(spacesRes, 'spaces-adapter-move');
  const rows = (parsed.spaces ?? []) as SpaceRow[];
  const g = rows.find((s) => s.type === 'group');
  const p = rows.find((s) => s.type === 'personal');
  const groupSpaceName = g?.name ?? null;
  const personalSpaceName = p?.name ?? null;

  const loadSpacesViaMcp = async (): Promise<SpaceRow[]> => {
    const result = await mcp.client.callTool({
      name: 'spaces',
      arguments: { include_adapter_titles: true }
    });
    const pr = parseMcpJson(result, 'spaces');
    return (pr.spaces ?? []) as SpaceRow[];
  };

  const skipReason = (serverOk: boolean): string | null => {
    if (!serverRequiresAuth() || !hasAuthToken()) return 'auth disabled or no token';
    if (!serverOk) return 'server unavailable';
    if (!groupSpaceName) return 'no group space in token (kairos-tester needs a group membership)';
    if (!personalSpaceName) return 'no personal space';
    return null;
  };

  return { mcp, groupSpaceName, personalSpaceName, loadSpacesViaMcp, skipReason };
}

/** Null bundle means auth off or missing token (see {@link openAdapterSpaceMcpBundle}). */
export function adapterSpaceSkipReason(
  bundle: AdapterSpaceMcpBundle | null,
  serverOk: boolean
): string | null {
  if (bundle == null) {
    if (!serverRequiresAuth() || !hasAuthToken()) return 'auth disabled or no token';
    return 'MCP connection failed';
  }
  return bundle.skipReason(serverOk);
}
