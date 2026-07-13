import { describe, expect, it } from "vitest";
import { readBooleanFeatureFlag, resolveProductionRuntime } from "./env";

describe("runtime mode resolution", () => {
  it("uses explicit runtime modes when they are present", () => {
    expect(resolveProductionRuntime("production", "file:///workspace/server/_core/env.ts")).toBe(true);
    expect(resolveProductionRuntime("development", "file:///workspace/dist/index.js")).toBe(false);
    expect(resolveProductionRuntime("test", "file:///workspace/dist/index.js")).toBe(false);
  });

  it("treats the bundled server entry point as production when NODE_ENV is absent", () => {
    expect(resolveProductionRuntime(undefined, "file:///workspace/dist/index.js")).toBe(true);
    expect(resolveProductionRuntime(undefined, "file:///workspace/server/_core/env.ts")).toBe(false);
  });
});

describe("readBooleanFeatureFlag", () => {
  it("uses the supplied default when a feature flag is not configured", () => {
    expect(readBooleanFeatureFlag(undefined, true)).toBe(true);
    expect(readBooleanFeatureFlag("", false)).toBe(false);
  });

  it("accepts explicit case-insensitive true and false overrides", () => {
    expect(readBooleanFeatureFlag(" TrUe ", false)).toBe(true);
    expect(readBooleanFeatureFlag(" FALSE ", true)).toBe(false);
  });

  it("does not turn malformed configuration into an accidental enablement", () => {
    expect(readBooleanFeatureFlag("enabled", false)).toBe(false);
  });
});
