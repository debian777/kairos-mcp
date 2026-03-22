import { describe, expect, it } from "vitest";
import { browseChainsFromSpaces } from "../../src/ui/utils/browse-chains";
import type { SpaceInfo } from "../../src/ui/hooks/useSpaces";

describe("browseChainsFromSpaces", () => {
  it("dedupes same chain_id across spaces (keeps higher step_count)", () => {
    const spaces: SpaceInfo[] = [
      {
        name: "Personal",
        chain_count: 1,
        chains: [{ chain_id: "abc", title: "Create New", step_count: 2 }],
      },
      {
        name: "App",
        chain_count: 1,
        chains: [{ chain_id: "abc", title: "Create New", step_count: 5 }],
      },
    ];
    const { browseChains, countsByLetter } = browseChainsFromSpaces(spaces);
    expect(browseChains).toHaveLength(1);
    expect(browseChains[0]!.step_count).toBe(5);
    expect(countsByLetter["C"]).toBe(1);
  });

  it("keeps distinct chain_ids with same title", () => {
    const spaces: SpaceInfo[] = [
      {
        name: "A",
        chain_count: 2,
        chains: [
          { chain_id: "id-1", title: "Same Title", step_count: 1 },
          { chain_id: "id-2", title: "Same Title", step_count: 1 },
        ],
      },
    ];
    const { browseChains, countsByLetter } = browseChainsFromSpaces(spaces);
    expect(browseChains).toHaveLength(2);
    expect(countsByLetter["S"]).toBe(2);
  });

  it("retains chains with empty chain_id (no dedupe)", () => {
    const spaces: SpaceInfo[] = [
      {
        name: "X",
        chain_count: 2,
        chains: [
          { chain_id: "", title: "Alpha", step_count: 1 },
          { chain_id: "", title: "Beta", step_count: 1 },
        ],
      },
    ];
    const { browseChains } = browseChainsFromSpaces(spaces);
    expect(browseChains).toHaveLength(2);
  });

  it("handles undefined spaces", () => {
    const { browseChains, countsByLetter } = browseChainsFromSpaces(undefined);
    expect(browseChains).toEqual([]);
    expect(countsByLetter["A"]).toBe(0);
  });
});
