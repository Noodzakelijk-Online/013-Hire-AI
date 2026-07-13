import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("user guide automation claims", () => {
  it("keeps employer-portal delivery under explicit user control", () => {
    const guide = readFileSync(resolve(process.cwd(), "docs", "USER_GUIDE.md"), "utf8");
    const apiReference = readFileSync(resolve(process.cwd(), "docs", "API_REFERENCE.md"), "utf8");
    const terms = readFileSync(resolve(process.cwd(), "client", "src", "pages", "TermsOfService.tsx"), "utf8");

    expect(guide).not.toContain("apply to jobs on your behalf");
    expect(guide).not.toContain("Automatic form filling");
    expect(guide).toContain("Manual handoff");
    expect(guide).toContain("record deterministic confirmation evidence");
    expect(guide).not.toContain("One-click apply");
    expect(apiReference).not.toContain("Automatically apply to a job.");
    expect(apiReference).toContain("never opens an employer portal");
    expect(terms).not.toContain("Platform submitted an application on your behalf");
    expect(terms).toContain("does not submit your resume or profile information");
  });
});
