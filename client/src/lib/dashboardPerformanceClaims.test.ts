import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("dashboard performance claims", () => {
  it("anchors outcome labels to operating-ledger evidence instead of benchmarks or hype", () => {
    const dashboard = readFileSync(resolve(process.cwd(), "client", "src", "pages", "Dashboard.tsx"), "utf8");

    expect(dashboard).toContain("getApplicationPerformanceSummary");
    expect(dashboard).toContain("Ledger-derived rates from confirmed submissions");
    expect(dashboard).not.toContain("Above average employer engagement");
    expect(dashboard).not.toContain("Strong interview invitation rate");
    expect(dashboard).not.toContain("Great progress!");
  });
});
