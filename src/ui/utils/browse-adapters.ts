import type { AdapterSummary, SpaceInfo } from "@/hooks/useSpaces";

/** Letters used for browse-by-label buckets (must match title's first character rule). */
export const BROWSE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("") as readonly string[];

/**
 * Flatten adapters from all spaces, dedupe by non-empty `adapter_id` (prefer higher `layer_count`),
 * then compute per-letter counts from deduped titles.
 */
export function browseAdaptersFromSpaces(spaces: SpaceInfo[] | undefined): {
  browseAdapters: AdapterSummary[];
  countsByLetter: Record<string, number>;
} {
  const flat: AdapterSummary[] = [];
  for (const space of spaces ?? []) {
    for (const adapter of space.adapters ?? []) {
      flat.push({
        adapter_id: adapter.adapter_id,
        title: adapter.title,
        layer_count: adapter.layer_count
      });
    }
  }

  const byId = new Map<string, AdapterSummary>();
  const withoutId: AdapterSummary[] = [];
  for (const adapter of flat) {
    const id = (adapter.adapter_id ?? "").trim();
    if (!id) {
      withoutId.push(adapter);
      continue;
    }
    const prev = byId.get(id);
    if (!prev) {
      byId.set(id, adapter);
    } else if ((adapter.layer_count ?? 0) > (prev.layer_count ?? 0)) {
      byId.set(id, adapter);
    }
  }

  const browseAdapters = [...byId.values(), ...withoutId];

  const countsByLetter: Record<string, number> = {};
  for (const letter of BROWSE_LETTERS) countsByLetter[letter] = 0;
  for (const adapter of browseAdapters) {
    const first = (adapter.title ?? "").trim().charAt(0).toUpperCase();
    if (BROWSE_LETTERS.includes(first)) countsByLetter[first] = (countsByLetter[first] ?? 0) + 1;
  }

  return { browseAdapters, countsByLetter };
}
