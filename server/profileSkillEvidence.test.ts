import { describe, expect, it } from "vitest";
import {
  mergeProfileSkillEvidence,
  resolveProfileSkillEvidence,
} from "@shared/profileSkillEvidence";
import { buildEvidenceBoundApplicationDraft } from "./applicationMaterialDraft";
import { buildAutonomousPlan } from "./autonomousOrchestrator";

describe("profile skill evidence", () => {
  it("combines legacy and structured skills without case-insensitive duplicates", () => {
    expect(mergeProfileSkillEvidence("React, TypeScript", [
      { skillName: "typescript" },
      { skillName: "Node.js" },
      { skillName: " React " },
    ])).toBe("React, TypeScript, Node.js");
  });

  it("creates a resolved view without mutating the persisted profile record", () => {
    const profile = { skills: null, desiredJobTypes: "Backend Engineer" };
    const resolved = resolveProfileSkillEvidence(profile, [{ skillName: "Python" }]);

    expect(resolved).toEqual({ skills: "Python", desiredJobTypes: "Backend Engineer" });
    expect(profile.skills).toBeNull();
  });

  it("keeps structured-only skills consistent across planning and review material", () => {
    const profile = resolveProfileSkillEvidence({
      skills: null,
      desiredJobTypes: "Platform Engineer",
      desiredLocations: "Remote",
      salaryExpectationMin: null,
      needsVisaSponsorship: 0,
    }, [{ skillName: "TypeScript" }]);
    const job = {
      id: 1,
      title: "Platform Engineer",
      company: "Example Co",
      location: "Remote - Worldwide",
      jobType: "full-time",
      skills: "TypeScript, Kubernetes",
      requirements: "Build services with TypeScript.",
      responsibilities: null,
      applicationUrl: "https://boards.example.com/jobs/1",
      applicationEmail: null,
      applicationProcess: "greenhouse",
      platformId: 1,
      salaryMin: null,
      salaryMax: null,
      visaSponsorshipAvailable: 1,
      isActive: 1,
      postedDate: new Date(),
      expiryDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    const plan = buildAutonomousPlan([job], profile, [], { minMatchScore: 0 });
    const draft = buildEvidenceBoundApplicationDraft(profile, job);

    expect(plan.decisions[0].reasons).toContain("1 required skills match the profile");
    expect(draft.coverLetter).toContain("TypeScript");
  });
});
