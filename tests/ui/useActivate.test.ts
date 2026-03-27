import { describe, expect, it } from "vitest";
import { buildActivateQueryOptions } from "@/hooks/useActivate";

describe("buildActivateQueryOptions", () => {
  it("normalizes whitespace for the cache key", () => {
    const options = buildActivateQueryOptions(" deploy protocol ", true);

    expect(options.queryKey).toEqual(["activate", "deploy protocol", null, null]);
    expect(options.enabled).toBe(true);
  });

  it("disables empty trimmed queries", () => {
    const options = buildActivateQueryOptions("   ", true);

    expect(options.queryKey).toEqual(["activate", "", null, null]);
    expect(options.enabled).toBe(false);
  });

  it("includes space in the cache key when provided", () => {
    const options = buildActivateQueryOptions("deploy", true, { space: "user:realm:sub" });

    expect(options.queryKey).toEqual(["activate", "deploy", "user:realm:sub", null]);
  });
});
