import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { ActivateOutput } from "../../tools/activate_schema.js";

async function activateAdapters(query: string): Promise<ActivateOutput> {
  const res = await apiFetch("/api/activate", {
    method: "POST",
    body: JSON.stringify({ query: query.trim() }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? res.statusText);
  }
  return (await res.json()) as ActivateOutput;
}

export function useActivate(query: string, enabled: boolean) {
  return useQuery({
    queryKey: ["activate", query],
    queryFn: () => activateAdapters(query),
    enabled: enabled && query.trim().length > 0,
  });
}
