import { describe, expect, it } from "vitest";
import { getApplicationMaterialEvidenceSummary } from "./applicationMaterialEvidence";

describe("application material evidence summary", () => {
  it("summarizes autonomous material claims and profile evidence", () => {
    const summary = getApplicationMaterialEvidenceSummary({
      coverLetter: "Prepared note",
      customAnswers: JSON.stringify({
        source: "autonomousService",
        action: "queue_for_review",
        atsType: "greenhouse",
        automationSupported: false,
        automationNotes: [
          "Hire.AI can prepare application material in its ledger, but it does not access employer portal forms.",
          "No unattended employer-portal integration is available. Review the prepared material and complete the employer handoff manually.",
        ],
      }),
      claimsMade: JSON.stringify({
        supportedClaimsOnly: true,
        reasons: ["3 required skills match the profile", "Remote-compatible role"],
        blockers: ["Resume is required before autonomous submission"],
        note: "No qualifications were fabricated.",
      }),
      sourceProfileSnapshot: JSON.stringify({
        source: "autonomousService",
        profile: {
          skills: "React, TypeScript, Node.js",
          experience: "Five years building production web apps.",
          education: "BSc Computer Science",
          desiredJobTypes: "full-time",
          desiredLocations: "remote, worldwide",
          salaryExpectationMin: 90000,
          salaryExpectationMax: 130000,
          resumeUrl: "https://example.com/resume.pdf",
          resumeFileKey: "resumes/42/resume.pdf",
        },
      }),
    });

    expect(summary.source).toBe("autonomousService");
    expect(summary.coverLetterLabel).toBe("Cover letter stored");
    expect(summary.customAnswerCount).toBe(3);
    expect(summary.supportSignals).toContain("3 required skills match the profile");
    expect(summary.supportSignals).toContain(
      "Hire.AI can prepare application material in its ledger, but it does not access employer portal forms."
    );
    expect(summary.blockers).toContain("Resume is required before autonomous submission");
    expect(summary.honestyNote).toBe("No qualifications were fabricated.");
    expect(summary.profileEvidence.skills).toContain("React");
    expect(summary.profileEvidence.salaryRange).toBe("$90,000 - $130,000");
    expect(summary.profileEvidence.resumeConnected).toBe(true);
  });

  it("handles older text claims without JSON", () => {
    const summary = getApplicationMaterialEvidenceSummary({
      claimsMade: "React, TypeScript, remote collaboration",
      sourceProfileSnapshot: JSON.stringify({
        profile: {
          skills: "React, TypeScript",
        },
      }),
    });

    expect(summary.supportSignals).toEqual(["React", "TypeScript", "remote collaboration"]);
    expect(summary.honestyNote).toContain("React");
    expect(summary.profileEvidence.skills).toBe("React, TypeScript");
  });

  it("returns safe defaults when no material exists", () => {
    const summary = getApplicationMaterialEvidenceSummary(null);

    expect(summary.hasMaterial).toBe(false);
    expect(summary.resumeLabel).toBe("No resume evidence linked");
    expect(summary.supportSignals).toEqual([]);
    expect(summary.blockers).toEqual([]);
    expect(summary.profileEvidence.resumeConnected).toBe(false);
  });
});
