import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { SearchOutput } from "../../tools/kairos_search_schema.js";

async function searchProtocols(query: string): Promise<SearchOutput> {
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
