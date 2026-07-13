import { describe, expect, it } from "vitest";
import { getInterviewSchedulingRequirement, getLatestSchedulableInterviewInvite } from "./interviewScheduling";

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

  it("only returns the latest invite when it has not already produced a schedule", () => {
    const invite = { id: 41, responseType: "interview_invite", receivedAt: new Date("2026-07-13T09:00:00.000Z") };
    const existingSchedule = {
      status: "scheduled",
      createdAt: new Date("2026-07-13T10:00:00.000Z"),
      employerResponseId: 41,
    };

    expect(getLatestSchedulableInterviewInvite([], [invite])).toEqual(invite);
    expect(getLatestSchedulableInterviewInvite([existingSchedule], [invite])).toBeNull();
  });

  it("keeps a later invite schedulable when the prior schedule has an explicit source response", () => {
    const laterInvite = { id: 43, responseType: "interview_invite", receivedAt: new Date("2026-07-13T10:00:00.000Z") };
    const earlierSchedule = {
      status: "completed",
      createdAt: new Date("2026-07-13T10:00:00.001Z"),
      employerResponseId: 42,
    };

    expect(getLatestSchedulableInterviewInvite([earlierSchedule], [laterInvite])).toEqual(laterInvite);
  });

  it("uses the newer response ID when two interview invites share a timestamp", () => {
    const receivedAt = new Date("2026-07-13T10:00:00.000Z");
    const firstInvite = { id: 51, responseType: "interview_invite", receivedAt };
    const laterInvite = { id: 52, responseType: "interview_invite", receivedAt };
    const firstSchedule = {
      status: "completed",
      createdAt: new Date("2026-07-13T10:00:00.001Z"),
      employerResponseId: 51,
    };

    expect(getLatestSchedulableInterviewInvite([firstSchedule], [firstInvite, laterInvite])).toEqual(laterInvite);
  });
});
