import { describe, expect, it } from "vitest";
import { getInterviewOperatingSummary } from "./interviewOperatingSummary";

const NOW = new Date("2026-06-29T12:00:00.000Z");

describe("interview operating summary", () => {
  it("does not ask for scheduling before an interview response exists", () => {
    const summary = getInterviewOperatingSummary({ status: "applied" }, [], NOW);

    expect(summary.status).toBe("not_applicable");
    expect(summary.canSchedule).toBe(false);
  });

  it("turns an interview-status application into scheduling work", () => {
    const summary = getInterviewOperatingSummary({ status: "interview" }, [], NOW);

    expect(summary.status).toBe("needs_scheduling");
    expect(summary.canSchedule).toBe(true);
    expect(summary.nextAction).toContain("scheduled interview");
  });

  it("prioritizes active scheduled interviews", () => {
    const summary = getInterviewOperatingSummary(
      { status: "interview" },
      [
        { status: "completed", scheduledAt: "2026-06-28T10:00:00.000Z" },
        { status: "scheduled", scheduledAt: "2026-07-01T09:30:00.000Z" },
      ],
      NOW
    );

    expect(summary.status).toBe("scheduled");
    expect(summary.activeInterviews).toBe(1);
    expect(summary.completedInterviews).toBe(1);
    expect(summary.nextInterviewAt?.toISOString()).toBe("2026-07-01T09:30:00.000Z");
  });

  it("keeps completed interviews distinct from unresolved scheduling work", () => {
    const summary = getInterviewOperatingSummary(
      { status: "interview" },
      [{ status: "completed", scheduledAt: "2026-06-28T10:00:00.000Z" }],
      NOW
    );

    expect(summary.status).toBe("completed");
    expect(summary.completedInterviews).toBe(1);
    expect(summary.canSchedule).toBe(true);
  });

  it("surfaces cancelled interviews as replacement-time work", () => {
    const summary = getInterviewOperatingSummary(
      { status: "interview" },
      [{ status: "cancelled", scheduledAt: "2026-06-30T10:00:00.000Z" }],
      NOW
    );

    expect(summary.status).toBe("cancelled");
    expect(summary.cancelledInterviews).toBe(1);
    expect(summary.canSchedule).toBe(true);
  });
});
