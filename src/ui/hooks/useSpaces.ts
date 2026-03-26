import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface AdapterSummary {
  adapter_id: string;
  title: string;
  layer_count: number;
}

export interface SpaceInfo {
  name: string;
  adapter_count: number;
  adapters?: AdapterSummary[];
}

export interface UseSpacesOptions {
  includeAdapterTitles?: boolean;
}

async function fetchSpaces(options: UseSpacesOptions = {}): Promise<{ spaces: SpaceInfo[] }> {
  const res = await apiFetch("/api/spaces", {
    method: "POST",
    body: JSON.stringify({
      include_adapter_titles: options.includeAdapterTitles ?? false,
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
  const includeAdapterTitles = options.includeAdapterTitles ?? false;
  return useQuery({
    queryKey: ["spaces", { includeAdapterTitles }],
    queryFn: () => fetchSpaces(options),
    enabled,
  });
}
