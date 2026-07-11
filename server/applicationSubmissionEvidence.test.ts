import { describe, expect, it } from "vitest";
import { normalizeSubmissionEvidence } from "./applicationSubmissionEvidence";

describe("submission evidence normalization", () => {
  it("builds an application ledger note from explicit proof", () => {
    const result = normalizeSubmissionEvidence({
      source: "employer_portal",
      evidence: "Portal showed confirmation ID ABC-123",
      confirmationUrl: "https://example.com/applications/abc-123",
    });

    expect(result.noteContent).toContain("employer portal confirmation");
    expect(result.noteContent).toContain("ABC-123");
    expect(result.confirmationUrl).toBe("https://example.com/applications/abc-123");
  });

  it("rejects vague or unsafe evidence", () => {
    expect(() =>
      normalizeSubmissionEvidence({ source: "manual", evidence: "done" })
    ).toThrow(/evidence/i);

    expect(() =>
      normalizeSubmissionEvidence({
        source: "manual",
        evidence: "The employer portal showed a submitted state.",
        confirmationUrl: "javascript:alert(1)",
      })
    ).toThrow(/HTTP or HTTPS/i);
  });
});
