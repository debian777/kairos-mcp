import { describe, expect, it } from "vitest";
import { buildActivateQueryOptions } from "@/hooks/useActivate";

describe("buildActivateQueryOptions", () => {
  it("normalizes whitespace for the cache key", () => {
    const options = buildActivateQueryOptions(" deploy protocol ", true);

    expect(options.queryKey).toEqual(["activate", "deploy protocol"]);
    expect(options.enabled).toBe(true);
  });

  it("disables empty trimmed queries", () => {
    const options = buildActivateQueryOptions("   ", true);

    expect(options.queryKey).toEqual(["activate", ""]);
    expect(options.enabled).toBe(false);
  });
});
