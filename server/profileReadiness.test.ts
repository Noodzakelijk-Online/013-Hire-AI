import { describe, expect, it } from "vitest";
import { calculateProfileReadiness } from "./profileReadiness";

describe("profile readiness", () => {
  it("blocks auto-apply when critical candidate evidence is missing", () => {
    const readiness = calculateProfileReadiness({
      profile: {
        skills: "TypeScript, React",
        experience: null,
        education: null,
        desiredJobTypes: "Frontend Engineer",
        desiredLocations: "Remote",
        salaryExpectationMin: null,
        salaryExpectationMax: null,
        resumeUrl: null,
        resumeFileKey: null,
        linkedinUrl: null,
        githubUrl: null,
        portfolioUrl: null,
      },
    });

    expect(readiness.autoApplyEligible).toBe(false);
    expect(readiness.blockers.map((gap) => gap.key)).toContain("resume");
    expect(readiness.blockers.map((gap) => gap.key)).toContain("experience");
  });

  it("marks a complete profile as eligible for autonomous preparation", () => {
    const readiness = calculateProfileReadiness({
      profile: {
        skills: "TypeScript, React, Node.js",
        experience: "5 years building SaaS products.",
        education: "BSc Computer Science",
        desiredJobTypes: "Full Stack Engineer",
        desiredLocations: "Remote, Europe",
        salaryExpectationMin: 8000,
        salaryExpectationMax: 12000,
        resumeUrl: "https://example.com/resume.pdf",
        resumeFileKey: "resumes/user/resume.pdf",
        linkedinUrl: "https://linkedin.com/in/example",
        githubUrl: null,
        portfolioUrl: null,
      },
      workExperiences: [{ jobTitle: "Engineer", company: "Acme", description: "Built product." }],
      skills: [{ skillName: "TypeScript" }],
    });

    expect(readiness.score).toBeGreaterThanOrEqual(85);
    expect(readiness.autoApplyEligible).toBe(true);
    expect(readiness.level).toBe("strong");
  });

  it("does not treat a standalone resume URL as an application-ready artifact", () => {
    const readiness = calculateProfileReadiness({
      profile: {
        skills: "TypeScript, React, Node.js",
        experience: "5 years building SaaS products.",
        education: "BSc Computer Science",
        desiredJobTypes: "Full Stack Engineer",
        desiredLocations: "Remote, Europe",
        salaryExpectationMin: 8000,
        salaryExpectationMax: 12000,
        resumeUrl: "https://example.com/resume.pdf",
        resumeFileKey: null,
        linkedinUrl: "https://linkedin.com/in/example",
        githubUrl: null,
        portfolioUrl: null,
      },
      workExperiences: [{ jobTitle: "Engineer", company: "Acme", description: "Built product." }],
      skills: [{ skillName: "TypeScript" }],
    });

    expect(readiness.signals.hasResume).toBe(false);
    expect(readiness.autoApplyEligible).toBe(false);
    expect(readiness.blockers.map((gap) => gap.key)).toContain("resume");
  });

  it("uses the active resume ledger over mutable profile metadata", () => {
    const readiness = calculateProfileReadiness({
      profile: {
        skills: "TypeScript, React, Node.js",
        experience: "5 years building SaaS products.",
        education: "BSc Computer Science",
        desiredJobTypes: "Full Stack Engineer",
        desiredLocations: "Remote, Europe",
        salaryExpectationMin: 8000,
        salaryExpectationMax: 12000,
        resumeUrl: "https://example.com/resume.pdf",
        resumeFileKey: "resumes/user/resume.pdf",
        linkedinUrl: "https://linkedin.com/in/example",
        githubUrl: null,
        portfolioUrl: null,
      },
      workExperiences: [{ jobTitle: "Engineer", company: "Acme", description: "Built product." }],
      skills: [{ skillName: "TypeScript" }],
      hasActiveResumeArtifact: false,
    });

    expect(readiness.signals.hasResume).toBe(false);
    expect(readiness.autoApplyEligible).toBe(false);
  });
});
