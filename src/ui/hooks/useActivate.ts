import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { ActivateOutput } from "../../tools/activate_schema.js";

export interface ActivateOptions {
  /** Scope activation to this space (raw id or forms accepted by the server). */
  space?: string;
  max_choices?: number;
}

async function activateAdapters(query: string, options?: ActivateOptions): Promise<ActivateOutput> {
  const body: Record<string, unknown> = { query: query.trim() };
  const s = options?.space?.trim();
  if (s) body.space = s;
  if (options?.max_choices != null) body.max_choices = options.max_choices;

  const res = await apiFetch("/api/activate", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? res.statusText);
  }
  return (await res.json()) as ActivateOutput;
}

export function buildActivateQueryOptions(query: string, enabled: boolean, options?: ActivateOptions) {
  const normalizedQuery = query.trim();
  const scope = options?.space?.trim() ?? "";
  return {
    queryKey: ["activate", normalizedQuery, scope || null, options?.max_choices ?? null] as const,
    queryFn: () => activateAdapters(normalizedQuery, options),
    enabled: enabled && normalizedQuery.length > 0,
  };
}

export function useActivate(query: string, enabled: boolean, options?: ActivateOptions) {
  return useQuery(buildActivateQueryOptions(query, enabled, options));
}
