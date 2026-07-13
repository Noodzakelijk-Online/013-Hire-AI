import { describe, expect, it } from "vitest";
import { getInterviewSchedulingControl } from "./interviewSchedulingControl";

describe("interview scheduling controls", () => {
  it("allows scheduling only from a recorded fresh invitation", () => {
    expect(getInterviewSchedulingControl("new_invite")).toMatchObject({
      action: "schedule-interview",
      canSchedule: true,
      actionLabel: "Schedule Interview",
    });
  });

  it("routes cancelled schedules back to fresh invitation evidence", () => {
    expect(getInterviewSchedulingControl("cancelled_schedule")).toMatchObject({
      action: "record-interview-invitation",
      canSchedule: false,
      actionLabel: "Record New Invitation",
    });
  });

  it("does not imply an interview-stage record can be scheduled without invitation evidence", () => {
    expect(getInterviewSchedulingControl("missing_schedule")).toMatchObject({
      action: "record-interview-invitation",
      canSchedule: false,
      badgeLabel: "Invitation evidence missing",
    });
  });
});
