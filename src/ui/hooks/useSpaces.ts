import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface ChainInfo {
  chain_id: string;
  title: string;
  step_count: number;
}

export interface SpaceInfo {
  name: string;
  chain_count: number;
  chains?: ChainInfo[];
}

export interface UseSpacesOptions {
  includeChainTitles?: boolean;
}

async function fetchSpaces(options: UseSpacesOptions = {}): Promise<{ spaces: SpaceInfo[] }> {
  const res = await apiFetch("/api/kairos_spaces", {
    method: "POST",
    body: JSON.stringify({
      include_chain_titles: options.includeChainTitles ?? false,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as { message?: string }).message ?? res.statusText;
    throw new Error(msg);
  }
  const json = await res.json();
  return { spaces: json.spaces ?? [] };
}

export function useSpaces(enabled = true, options: UseSpacesOptions = {}) {
  const includeChainTitles = options.includeChainTitles ?? false;
  return useQuery({
    queryKey: ["spaces", { includeChainTitles }],
    queryFn: () => fetchSpaces(options),
    enabled,
  });
}
