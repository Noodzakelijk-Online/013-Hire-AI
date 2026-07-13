import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("user guide automation claims", () => {
  it("keeps employer-portal delivery under explicit user control", () => {
    const guide = readFileSync(resolve(process.cwd(), "docs", "USER_GUIDE.md"), "utf8");

    expect(guide).not.toContain("apply to jobs on your behalf");
    expect(guide).not.toContain("Automatic form filling");
    expect(guide).toContain("Manual handoff");
    expect(guide).toContain("record deterministic confirmation evidence");
  });
});
