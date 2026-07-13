import { describe, expect, it } from "vitest";
import { shouldShowProfileOnboarding } from "./profileOnboarding";

describe("profile onboarding", () => {
  it("does not prompt a candidate with structured work history or skills", () => {
    expect(shouldShowProfileOnboarding({
      loading: false,
      isAuthenticated: true,
      tosAccepted: true,
      readiness: { signals: { hasSkills: true, hasWorkHistory: true } },
    })).toBe(false);
  });

  it("prompts only after authenticated users accept terms and readiness proves no candidate evidence", () => {
    const noEvidence = { signals: { hasSkills: false, hasExperience: false, hasWorkHistory: false, hasEducation: false } };

    expect(shouldShowProfileOnboarding({
      loading: false,
      isAuthenticated: true,
      tosAccepted: true,
      readiness: noEvidence,
    })).toBe(true);
    expect(shouldShowProfileOnboarding({
      loading: false,
      isAuthenticated: true,
      tosAccepted: false,
      readiness: noEvidence,
    })).toBe(false);
  });
});
