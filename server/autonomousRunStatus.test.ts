import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import {
  acquireAutonomousRunLease,
  completeAutonomousRunLease,
  getAutonomousRunState,
  skipAutonomousRunLease,
} from "./db";
import { getAutonomousScanIntervalMs } from "./autonomousOrchestrator";
import { appRouter } from "./routers";

function createContext(userId: number): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `autonomous-run-status-${userId}`,
      name: "Autonomous Run Status",
      email: `autonomous-run-status-${userId}@example.local`,
      loginMethod: "test",
      role: "user",
      stripeCustomerId: null,
      accountStatus: "active",
      tosAcceptedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("autonomous scheduler status", () => {
  it("falls back to the durable run result when this process has no scheduler memory", async () => {
    const userId = 91006;
    expect(await acquireAutonomousRunLease(userId, "durable-status", 0)).toBe(true);
    await completeAutonomousRunLease(userId, "durable-status", undefined, {
      queuedApplicationRecords: 1,
      queuedReviewRecords: 1,
      queuedManualRecords: 1,
      queuedFollowUps: 2,
      skippedDuplicateFollowUps: 1,
      skippedSafetyBlockedFollowUps: 1,
      skippedResumeEvidenceActions: 0,
      skippedProfileReadinessActions: 2,
      skippedEvidenceGatedActions: 3,
      skippedStaleJobActions: 2,
      skippedEmptySourceActions: 1,
      userDecisionLockedJobs: 2,
      failedActions: 0,
    });

    const status = await appRouter
      .createCaller(createContext(userId))
      .automation.schedulerStatus();

    expect(status).toMatchObject({
      lastStatus: "completed",
      usersRun: 1,
      jobsQueued: 3,
      followUpDraftsQueued: 2,
      duplicateFollowUpsSkipped: 1,
      profileReadinessBlockedActions: 2,
      evidenceGatedActions: 3,
      staleJobActionsSkipped: 2,
      emptySourceActionsSkipped: 1,
      userDecisionLockedJobs: 2,
    });
    expect(status.lastCycleAt).toBeInstanceOf(Date);
  });

  it("reports a failed run from its own start time without reusing prior completed counts", async () => {
    const userId = 91007;
    expect(await acquireAutonomousRunLease(userId, "completed", 0)).toBe(true);
    await completeAutonomousRunLease(userId, "completed", undefined, {
      queuedApplicationRecords: 2,
      queuedReviewRecords: 0,
      queuedManualRecords: 0,
      queuedFollowUps: 1,
      skippedDuplicateFollowUps: 0,
      skippedSafetyBlockedFollowUps: 0,
      skippedResumeEvidenceActions: 0,
      skippedProfileReadinessActions: 0,
      skippedEvidenceGatedActions: 0,
      skippedStaleJobActions: 0,
      skippedEmptySourceActions: 0,
      failedActions: 0,
    });
    expect(await acquireAutonomousRunLease(userId, "failed", 0)).toBe(true);
    await completeAutonomousRunLease(userId, "failed", "Profile evidence could not be refreshed.");
    const persisted = await getAutonomousRunState(userId);

    const status = await appRouter
      .createCaller(createContext(userId))
      .automation.schedulerStatus();

    expect(status).toMatchObject({
      lastStatus: "failed",
      lastError: "Profile evidence could not be refreshed.",
      usersRun: 0,
      jobsQueued: 0,
      followUpDraftsQueued: 0,
      errorCount: 1,
    });
    expect(status.lastCycleAt?.getTime()).toBe(persisted?.lastStartedAt?.getTime());
  });

  it("reports a user-controlled preflight stop as skipped instead of a worker error", async () => {
    const userId = 91009;
    expect(await acquireAutonomousRunLease(userId, "skipped", 0)).toBe(true);
    await skipAutonomousRunLease(userId, "skipped", "Campaign was paused before the scheduled run started.");
    const persisted = await getAutonomousRunState(userId);

    const status = await appRouter
      .createCaller(createContext(userId))
      .automation.schedulerStatus();

    expect(status).toMatchObject({
      lastStatus: "skipped",
      lastError: null,
      lastOutcomeDetail: "Campaign was paused before the scheduled run started.",
      usersRun: 0,
      jobsQueued: 0,
      errorCount: 0,
    });
    expect(status.lastCycleAt?.getTime()).toBe(persisted?.lastStartedAt?.getTime());
  });

  it("reports the user's cadence-based next eligible run instead of the worker poll tick", async () => {
    const userId = 91008;
    const caller = appRouter.createCaller(createContext(userId));
    await caller.profile.update({
      preferences: JSON.stringify({ autonomousEnabled: true, scanFrequency: "hourly" }),
    });
    expect(await acquireAutonomousRunLease(userId, "hourly-status", 0)).toBe(true);
    await completeAutonomousRunLease(userId, "hourly-status", undefined, {
      queuedApplicationRecords: 0,
      queuedReviewRecords: 0,
      queuedManualRecords: 0,
      queuedFollowUps: 0,
      skippedDuplicateFollowUps: 0,
      skippedSafetyBlockedFollowUps: 0,
      skippedResumeEvidenceActions: 0,
      skippedProfileReadinessActions: 0,
      skippedEvidenceGatedActions: 0,
      skippedStaleJobActions: 0,
      skippedEmptySourceActions: 0,
      failedActions: 0,
    });

    const persisted = await getAutonomousRunState(userId);
    const status = await caller.automation.schedulerStatus();

    expect(status).toMatchObject({
      userEnabled: true,
      scanFrequency: "hourly",
      isDue: false,
    });
    expect(status.nextEligibleAt?.getTime()).toBe(
      persisted?.lastCompletedAt?.getTime()! + getAutonomousScanIntervalMs("hourly")
    );
  });
});
