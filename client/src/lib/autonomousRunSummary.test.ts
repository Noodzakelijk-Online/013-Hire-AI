import { describe, expect, it } from "vitest";
import {
  formatAutonomousRunSummary,
  getAutonomousRunCounts,
  hasAutonomousRunAttention,
} from "./autonomousRunSummary";

describe("autonomous run summary", () => {
  it("combines job tasks and follow-up drafts", () => {
    const result = {
      queuedApplicationRecords: 1,
      queuedReviewRecords: 2,
      queuedManualRecords: 0,
      queuedFollowUps: 1,
    };

    expect(getAutonomousRunCounts(result)).toMatchObject({
      jobTasks: 3,
      followUpDrafts: 1,
      totalCreated: 4,
    });
    expect(formatAutonomousRunSummary(result)).toBe("Queued 3 job tasks and 1 follow-up draft");
  });

  it("reports skipped follow-ups and failures", () => {
    expect(formatAutonomousRunSummary({
      skippedDuplicateFollowUps: 2,
      skippedSafetyBlockedFollowUps: 1,
      failedActions: 1,
    })).toBe("Autonomous run completed with no new tasks; 2 duplicate follow-ups skipped; 1 follow-up paused for higher-priority review; 1 action failed");
  });

  it("reports evidence-gated external actions", () => {
    const result = {
      queuedReviewRecords: 1,
      skippedEvidenceGatedActions: 2,
      evidenceGates: [{ id: "profile-core-evidence", label: "Evidence blocked", severity: "high" }],
    };

    expect(getAutonomousRunCounts(result)).toMatchObject({
      jobTasks: 1,
      evidenceGatedActions: 2,
      evidenceGates: 1,
    });
    expect(formatAutonomousRunSummary(result)).toBe(
      "Queued 1 job task; 2 external actions gated by profile or connector evidence"
    );
  });

  it("explains when application preparation is blocked by missing resume evidence", () => {
    const result = {
      skippedResumeEvidenceActions: 2,
      evidenceGates: [{ id: "profile-core-evidence", label: "Evidence blocked", severity: "high" }],
    };

    expect(getAutonomousRunCounts(result)).toMatchObject({
      resumeEvidenceBlockedActions: 2,
      evidenceGates: 1,
    });
    expect(formatAutonomousRunSummary(result)).toBe(
      "Autonomous run completed with no new tasks; 2 application preparations blocked until an active resume is linked; 1 evidence gate active"
    );
  });

  it("explains when core profile evidence blocks application preparation", () => {
    const result = {
      skippedProfileReadinessActions: 2,
    };

    expect(getAutonomousRunCounts(result)).toMatchObject({
      profileReadinessBlockedActions: 2,
    });
    expect(formatAutonomousRunSummary(result)).toBe(
      "Autonomous run completed with no new tasks; 2 application preparations blocked until core profile evidence is complete"
    );
  });

  it("reports expired or stale postings excluded from preparation", () => {
    expect(formatAutonomousRunSummary({
      summary: { expiredJobsSkipped: 2 },
    })).toBe("Autonomous run completed with no new tasks; 2 expired or stale job postings excluded");
  });

  it("reports jobs that became stale after planning", () => {
    expect(formatAutonomousRunSummary({
      skippedStaleJobActions: 1,
    })).toBe(
      "Autonomous run completed with no new tasks; 1 job preparation blocked after a final listing freshness check"
    );
  });

  it("reports preparation halted by confirmed empty source scans", () => {
    const result = { skippedEmptySourceActions: 1 };

    expect(getAutonomousRunCounts(result)).toMatchObject({
      emptySourceActionsSkipped: 1,
    });
    expect(hasAutonomousRunAttention(result)).toBe(true);
    expect(formatAutonomousRunSummary(result)).toBe(
      "Autonomous run completed with no new tasks; 1 job preparation blocked because every observed source reported no listings"
    );
  });

  it("reports jobs retained under explicit user decisions", () => {
    expect(getAutonomousRunCounts({ userDecisionLockedJobs: 2 })).toMatchObject({
      userDecisionLockedJobs: 2,
    });
    expect(formatAutonomousRunSummary({ userDecisionLockedJobs: 2 })).toBe(
      "Autonomous run completed with no new tasks; 2 jobs retained under an explicit user decision"
    );
  });

  it("reports inbox monitoring failures as attention-required work", () => {
    expect(formatAutonomousRunSummary({
      inboxMonitoringFailures: 1,
    })).toBe("Autonomous run completed with no new tasks; 1 inbox monitor needs attention");
  });

  it("marks blocked, gated, and failed work as requiring operator attention", () => {
    expect(hasAutonomousRunAttention({ queuedReviewRecords: 1 })).toBe(false);
    expect(hasAutonomousRunAttention({ inboxMonitoringFailures: 1 })).toBe(true);
    expect(hasAutonomousRunAttention({ skippedEvidenceGatedActions: 1 })).toBe(true);
    expect(hasAutonomousRunAttention({ skippedSafetyBlockedFollowUps: 1 })).toBe(true);
  });
});
