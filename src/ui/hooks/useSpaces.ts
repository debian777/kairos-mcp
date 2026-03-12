import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface SpaceInfo {
  name: string;
  chain_count: number;
}

async function fetchSpaces(): Promise<{ spaces: SpaceInfo[] }> {
  const res = await apiFetch("/api/kairos_spaces", {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as { message?: string }).message ?? res.statusText;
    throw new Error(msg);
  }
  const json = await res.json();
  return { spaces: json.spaces ?? [] };
}

export function useSpaces(enabled = true) {
  return useQuery({
    queryKey: ["spaces"],
    queryFn: fetchSpaces,
    enabled,
  });
}
