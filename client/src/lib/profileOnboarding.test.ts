import { describe, expect, it } from "vitest";
import { shouldShowNewUserDashboard, shouldShowProfileOnboarding } from "./profileOnboarding";

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

  it("shows the first-time dashboard state only when readiness confirms there is no candidate evidence", () => {
    const onboarding = {
      loading: false,
      isAuthenticated: true,
      tosAccepted: true,
    };

    expect(shouldShowNewUserDashboard({
      totalApplications: 0,
      onboarding: { ...onboarding, readiness: { signals: { hasSkills: true } } },
    })).toBe(false);
    expect(shouldShowNewUserDashboard({
      totalApplications: 0,
      onboarding: { ...onboarding, readiness: { signals: {} } },
    })).toBe(true);
    expect(shouldShowNewUserDashboard({
      totalApplications: 1,
      onboarding: { ...onboarding, readiness: { signals: {} } },
    })).toBe(false);
  });
});
