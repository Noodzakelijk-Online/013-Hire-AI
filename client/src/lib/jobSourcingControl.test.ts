import { describe, expect, it } from "vitest";
import { getJobSourcingControlSummary } from "./jobSourcingControl";

describe("job sourcing control summary", () => {
  it("reports empty filtered state", () => {
    const summary = getJobSourcingControlSummary([]);

    expect(summary.status).toBe("empty");
    expect(summary.totalJobs).toBe(0);
    expect(summary.primaryTab).toBe("all");
  });

  it("prioritizes blockers before review-ready matches", () => {
    const summary = getJobSourcingControlSummary([
      {
        matchSummary: {
          recommendedDecision: "review",
          riskLevel: "low",
          blockers: [],
          matchScore: 91,
        },
      },
      {
        matchSummary: {
          recommendedDecision: "review",
          riskLevel: "high",
          blockers: ["Resume is required before submission"],
          matchScore: 87,
        },
      },
    ]);

    expect(summary.status).toBe("blocked");
    expect(summary.blocked).toBe(1);
    expect(summary.reviewReady).toBe(2);
    expect(summary.highMatch).toBe(2);
    expect(summary.primaryTab).toBe("all");
    expect(summary.primaryCta).toBe("Review blockers");
  });

  it("surfaces review-ready jobs when no blockers exist", () => {
    const summary = getJobSourcingControlSummary([
      {
        matchSummary: {
          recommendedDecision: "review",
          riskLevel: "low",
          blockers: [],
          matchScore: 84,
          isDecided: true,
        },
      },
      {
        matchSummary: {
          recommendedDecision: "save",
          riskLevel: "medium",
          blockers: [],
          matchScore: 66,
        },
      },
    ]);

    expect(summary.status).toBe("review_ready");
    expect(summary.reviewReady).toBe(1);
    expect(summary.decided).toBe(1);
    expect(summary.averageScore).toBe(75);
  });

  it("routes manual application work to good matches", () => {
    const summary = getJobSourcingControlSummary([
      {
        matchSummary: {
          recommendedDecision: "manual_apply",
          riskLevel: "high",
          blockers: [],
          matchScore: 73,
        },
      },
    ]);

    expect(summary.status).toBe("manual_tasks");
    expect(summary.manualTasks).toBe(1);
    expect(summary.primaryTab).toBe("good");
  });

  it("routes partial matches to save-for-later work", () => {
    const summary = getJobSourcingControlSummary([
      {
        matchSummary: {
          recommendedDecision: "save",
          riskLevel: "medium",
          blockers: [],
          matchScore: 62,
        },
      },
      {
        matchSummary: {
          recommendedDecision: "save",
          riskLevel: "medium",
          blockers: [],
          matchScore: 58,
        },
      },
    ]);

    expect(summary.status).toBe("save_for_later");
    expect(summary.saveForLater).toBe(2);
    expect(summary.primaryTab).toBe("good");
  });

  it("reports low signal when all jobs should be ignored", () => {
    const summary = getJobSourcingControlSummary([
      {
        matchSummary: {
          recommendedDecision: "ignore",
          riskLevel: "high",
          blockers: [],
          matchScore: 35,
        },
      },
    ]);

    expect(summary.status).toBe("low_signal");
    expect(summary.ignored).toBe(1);
    expect(summary.primaryTab).toBe("fair");
  });
});
