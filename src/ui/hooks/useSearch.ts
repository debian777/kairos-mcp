import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface SearchChoice {
  uri: string;
  label: string;
  chain_label: string | null;
  score: number | null;
  role: "match" | "refine" | "create";
  tags: string[];
  next_action: string;
  protocol_version?: string | null;
}

export interface SearchResult {
  choices: SearchChoice[];
  message?: string;
  next_action?: string;
}

async function searchProtocols(query: string): Promise<SearchResult> {
  const res = await apiFetch("/api/kairos_search", {
    method: "POST",
    body: JSON.stringify({ query: query.trim() }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? res.statusText);
  }
  return res.json();
}

export function useSearch(query: string, enabled: boolean) {
  return useQuery({
    queryKey: ["search", query],
    queryFn: () => searchProtocols(query),
    enabled: enabled && query.trim().length > 0,
  });
}
