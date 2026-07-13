import { describe, expect, it } from "vitest";
import {
  buildEvidenceBoundApplicationDraft,
  buildReviewApplicationMaterial,
} from "./applicationMaterialDraft";

describe("evidence-bound application drafts", () => {
  const job = {
    title: "Senior Platform Engineer",
    company: "Example Co",
    skills: "TypeScript, Kubernetes, AWS",
    requirements: "Use TypeScript and Kubernetes to operate cloud infrastructure.",
    responsibilities: null,
  };

  it("names only profile-backed skills and captures them as structured evidence", () => {
    const draft = buildEvidenceBoundApplicationDraft({
      skills: "TypeScript, React, AWS",
      experience: "Relevant experience",
      education: null,
    }, job);
    const claims = JSON.parse(draft.claimsMade);

    expect(draft.coverLetter).toContain("TypeScript, AWS");
    expect(draft.coverLetter).not.toContain("React, AWS");
    expect(claims.supportedSkills).toEqual(["TypeScript", "AWS"]);
    expect(claims.matchedSkills).toEqual(["TypeScript", "AWS"]);
    expect(draft.coverLetter).toContain("does not assert unverified qualifications");
  });

  it("does not create qualification claims when profile skills are missing", () => {
    const draft = buildEvidenceBoundApplicationDraft({
      skills: null,
      experience: null,
      education: null,
    }, job);
    const claims = JSON.parse(draft.claimsMade);

    expect(draft.coverLetter).toContain("does not yet contain verified skill evidence");
    expect(claims.supportedSkills).toEqual([]);
    expect(claims.matchedSkills).toEqual([]);
  });

  it("preserves a candidate-authored letter while marking it for manual claim review", () => {
    const material = buildReviewApplicationMaterial(
      { skills: "TypeScript, React, AWS", experience: null, education: null },
      job,
      "I hold every certification required for this role."
    );
    const claims = JSON.parse(material.claimsMade);
    const answers = JSON.parse(material.customAnswers);

    expect(material.coverLetter).toBe("I hold every certification required for this role.");
    expect(material.materialSource).toBe("user_provided_cover_letter");
    expect(material.userProvidedCoverLetter).toBe(true);
    expect(claims.supportedClaimsOnly).toBe(false);
    expect(claims.blockers).toContain(
      "Candidate-authored cover letter requires claim-by-claim review before external submission."
    );
    expect(answers.source).toBe("user_provided_cover_letter");
  });
});
