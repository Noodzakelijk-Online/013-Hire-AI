import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("public landing-page claims", () => {
  it("keeps outcome claims review-first and free of invented social proof", () => {
    const landing = readFileSync(resolve(process.cwd(), "client", "src", "pages", "LandingPage.tsx"), "utf8");

    expect(landing).toContain("does not silently submit applications");
    expect(landing).toContain("review-gated handoff");
    expect(landing).not.toMatch(/\b\d{1,3}(?:,\d{3})+\+?\s+(?:job seekers|users|people hired|applications)/i);
    expect(landing).not.toMatch(/(?:testimonial|what our users say|success stor(?:y|ies))/i);
  });
});
