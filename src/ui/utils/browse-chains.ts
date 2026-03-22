import type { ChainInfo, SpaceInfo } from "@/hooks/useSpaces";

/** Letters used for browse-by-label buckets (must match title’s first character rule). */
export const BROWSE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("") as readonly string[];

/**
 * Flatten chains from all spaces, dedupe by non-empty `chain_id` (prefer higher `step_count`),
 * then compute per-letter counts from deduped titles.
 */
export function browseChainsFromSpaces(spaces: SpaceInfo[] | undefined): {
  browseChains: ChainInfo[];
  countsByLetter: Record<string, number>;
} {
  const flat: ChainInfo[] = [];
  for (const space of spaces ?? []) {
    for (const c of space.chains ?? []) {
      flat.push({ chain_id: c.chain_id, title: c.title, step_count: c.step_count });
    }
  }

  const byId = new Map<string, ChainInfo>();
  const withoutId: ChainInfo[] = [];
  for (const c of flat) {
    const id = (c.chain_id ?? "").trim();
    if (!id) {
      withoutId.push(c);
      continue;
    }
    const prev = byId.get(id);
    if (!prev) {
      byId.set(id, c);
    } else if ((c.step_count ?? 0) > (prev.step_count ?? 0)) {
      byId.set(id, c);
    }
  }

  const browseChains = [...byId.values(), ...withoutId];

  const countsByLetter: Record<string, number> = {};
  for (const letter of BROWSE_LETTERS) countsByLetter[letter] = 0;
  for (const c of browseChains) {
    const first = (c.title ?? "").trim().charAt(0).toUpperCase();
    if (BROWSE_LETTERS.includes(first)) countsByLetter[first] = (countsByLetter[first] ?? 0) + 1;
  }

  return { browseChains, countsByLetter };
}
