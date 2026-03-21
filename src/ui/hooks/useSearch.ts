import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { ActivateOutput } from "../../tools/activate_schema.js";
import type { SearchOutput } from "../../tools/kairos_search_schema.js";

function normalizeActivate(output: ActivateOutput): SearchOutput {
  return {
    must_obey: output.must_obey,
    message: output.message,
    next_action: output.next_action,
    choices: output.choices.map((choice) => ({
      uri: choice.uri,
      label: choice.label,
      chain_label: choice.adapter_name,
      score: choice.activation_score,
      role: choice.role,
      tags: choice.tags,
      next_action: choice.next_action,
      protocol_version: choice.adapter_version
    }))
  };
}

async function searchProtocols(query: string): Promise<SearchOutput> {
  const res = await apiFetch("/api/activate", {
    method: "POST",
    body: JSON.stringify({ query: query.trim() }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? res.statusText);
  }
  const output = (await res.json()) as ActivateOutput;
  return normalizeActivate(output);
}

export function useSearch(query: string, enabled: boolean) {
  return useQuery({
    queryKey: ["search", query],
    queryFn: () => searchProtocols(query),
    enabled: enabled && query.trim().length > 0,
  });
}
