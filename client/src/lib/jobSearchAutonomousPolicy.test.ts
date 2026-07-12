import { describe, expect, it } from "vitest";
import {
  defaultJobSearchAutonomousPolicy,
  getJobSearchAutonomousPolicy,
  isJobSearchAutonomousPolicyDirty,
  mergeJobSearchAutonomousPolicy,
} from "./jobSearchAutonomousPolicy";

describe("job search autonomous policy", () => {
  it("uses safe defaults for missing or malformed preferences", () => {
    expect(getJobSearchAutonomousPolicy()).toEqual(defaultJobSearchAutonomousPolicy);
    expect(getJobSearchAutonomousPolicy("not json")).toEqual(defaultJobSearchAutonomousPolicy);
  });

  it("reads only policy controls relevant to Job Search", () => {
    expect(getJobSearchAutonomousPolicy(JSON.stringify({
      mode: "auto_apply",
      remoteOnly: false,
      requireHumanReview: false,
      allowUnsupportedATS: true,
      createFollowUps: true,
      dailyApplicationLimit: 7,
    }))).toEqual({
      mode: "auto_apply",
      remoteOnly: false,
      requireHumanReview: false,
      allowUnsupportedATS: true,
      createFollowUps: true,
    });
  });

  it("detects changed policy controls before a run", () => {
    const persisted = JSON.stringify({
      ...defaultJobSearchAutonomousPolicy,
      autonomousEnabled: true,
    });

    expect(isJobSearchAutonomousPolicyDirty(
      persisted,
      defaultJobSearchAutonomousPolicy
    )).toBe(false);
    expect(isJobSearchAutonomousPolicyDirty(persisted, {
      ...defaultJobSearchAutonomousPolicy,
      createFollowUps: true,
    })).toBe(true);
  });

  it("preserves unrelated preferences when saving the Job Search policy", () => {
    const merged = JSON.parse(mergeJobSearchAutonomousPolicy(JSON.stringify({
      autonomousEnabled: true,
      dailyApplicationLimit: 7,
      scanFrequency: "hourly",
    }), {
      mode: "auto_apply",
      remoteOnly: false,
      requireHumanReview: true,
      allowUnsupportedATS: false,
      createFollowUps: true,
    }));

    expect(merged).toMatchObject({
      autonomousEnabled: true,
      dailyApplicationLimit: 7,
      scanFrequency: "hourly",
      mode: "auto_apply",
      remoteOnly: false,
      requireHumanReview: true,
      allowUnsupportedATS: false,
      createFollowUps: true,
    });
  });
});
