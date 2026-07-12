import { describe, expect, it } from "vitest";
import { getInterviewSchedulingRequirement } from "./interviewScheduling";

describe("getInterviewSchedulingRequirement", () => {
  it("requires scheduling when a newer invite arrives after an existing scheduled round", () => {
    const firstRoundCreatedAt = new Date("2026-07-13T09:00:00.000Z");
    const nextRoundInviteAt = new Date("2026-07-13T10:00:00.000Z");

    expect(getInterviewSchedulingRequirement(
      [{ status: "scheduled", createdAt: firstRoundCreatedAt }],
      [{ responseType: "interview_invite", receivedAt: nextRoundInviteAt }]
    )).toBe("new_invite");
  });

  it("accepts a schedule that was created after the latest invite", () => {
    const inviteAt = new Date("2026-07-13T09:00:00.000Z");
    const nextRoundCreatedAt = new Date("2026-07-13T10:00:00.000Z");

    expect(getInterviewSchedulingRequirement(
      [{ status: "rescheduled", createdAt: nextRoundCreatedAt }],
      [{ responseType: "interview_invite", receivedAt: inviteAt }]
    )).toBeNull();
  });

  it("keeps a scheduled round clear when there is no newer invite", () => {
    expect(getInterviewSchedulingRequirement(
      [{ status: "scheduled", createdAt: new Date("2026-07-13T09:00:00.000Z") }],
      []
    )).toBeNull();
  });
});
