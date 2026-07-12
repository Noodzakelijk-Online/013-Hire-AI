import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Saved Jobs application control", () => {
  it("uses the evidence-gated decision contract instead of direct preparation", () => {
    const source = readFileSync(resolve(process.cwd(), "client", "src", "pages", "SavedJobs.tsx"), "utf8");

    expect(source).toContain("trpc.applications.decide.useMutation");
    expect(source).toContain("buildJobPreparationDecisionInput(job, summary, \"Saved Jobs\")");
    expect(source).toContain("preparationEvidenceGate");
    expect(source).not.toContain("trpc.applications.create.useMutation");
  });
});
