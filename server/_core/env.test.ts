import { describe, expect, it } from "vitest";
import { resolveProductionRuntime } from "./env";

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
