import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import {
  createApplicationDecision,
  getApplicationLedgerArtifacts,
  getAuditEventsForUser,
  getUserApplications,
  getUserApplicationDecisions,
  listAdminReviewItems,
  listUserApplicationApprovals,
} from "./db";
import { getUserOperatingLedger } from "./applicationCampaigns";

function createContext(userId: number): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `decision-user-${userId}`,
      name: "Decision User",
      email: `decision-${userId}@example.local`,
      loginMethod: "test",
      role: "user",
      stripeCustomerId: null,
      accountStatus: "active",
      tosAcceptedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("application decision ledger", () => {
  it("keeps one latest decision per user and job", async () => {
    const userId = 94001;
    const jobId = 1;

    const first = await createApplicationDecision({
      userId,
      jobId,
      decision: "review",
      decisionReason: "Review before applying.",
      matchScore: 83,
      riskLevel: "medium",
      reviewRequired: 1,
      reviewReason: "Human review required.",
      decidedBy: "system",
    });
    const second = await createApplicationDecision({
      userId,
      jobId,
      decision: "save",
      decisionReason: "Saved for later.",
      matchScore: 83,
      riskLevel: "low",
      reviewRequired: 1,
      reviewReason: "Saved from job search.",
      decidedBy: "user",
    });

    const decisions = await getUserApplicationDecisions(userId);

    expect(first.insertId).toBeTruthy();
    expect(second.existing).toBe(true);
    expect(decisions).toHaveLength(1);
    expect(decisions[0].decision).toBe("save");
    expect(decisions[0].decidedBy).toBe("user");
  });

  it("does not duplicate generated review artifacts when the same job is queued again", async () => {
    const userId = 94002;
    const caller = appRouter.createCaller(createContext(userId));

    const first = await caller.applications.decide({
      jobId: 1,
      decision: "review",
      decisionReason: "Queue this application for controlled review.",
      matchScore: 84,
      riskLevel: "medium",
      reviewRequired: true,
      reviewReason: "First review pass.",
    });
    const second = await caller.applications.decide({
      jobId: 1,
      decision: "review",
      decisionReason: "Queue this application for controlled review again.",
      matchScore: 86,
      riskLevel: "medium",
      reviewRequired: true,
      reviewReason: "Updated review pass.",
    });

    const applicationId = first.applicationRecordId!;
    const artifacts = await getApplicationLedgerArtifacts(applicationId, userId);
    const approvals = await listUserApplicationApprovals(userId, "pending");
    const adminReviews = await listAdminReviewItems("all");
    const userAuditEvents = await getAuditEventsForUser(userId, 20);
    const queuedAuditEvents = userAuditEvents.filter((event) =>
      event.entityType === "application" &&
      event.entityId === applicationId &&
      event.action === "application_queued_for_review"
    );
    const decisionAuditEvents = userAuditEvents.filter((event) =>
      event.entityType === "job" &&
      event.entityId === 1 &&
      event.action === "application_decision_recorded"
    );

    expect(second.applicationRecordId).toBe(applicationId);
    expect(second.existing).toBe(true);
    expect(artifacts.attempts.filter((attempt) => attempt.attemptType === "prepare")).toHaveLength(1);
    expect(queuedAuditEvents).toHaveLength(1);
    expect(decisionAuditEvents).toHaveLength(2);
    expect(approvals.filter((approval) =>
      approval.applicationId === applicationId &&
      approval.approvalType === "application_submission"
    )).toHaveLength(1);
    expect(adminReviews.filter((review) =>
      review.userId === userId &&
      review.entityType === "application" &&
      review.entityId === applicationId &&
      review.category === "application_review"
    )).toHaveLength(1);
  });

  it("closes stale prepared application work when a review item is ignored", async () => {
    const userId = 94003;
    const caller = appRouter.createCaller(createContext(userId));

    const queued = await caller.applications.decide({
      jobId: 2,
      decision: "review",
      decisionReason: "Queue this job for review.",
      matchScore: 82,
      riskLevel: "medium",
      reviewRequired: true,
      reviewReason: "Needs user review before submission.",
    });
    const applicationId = queued.applicationRecordId!;

    await caller.applications.decide({
      jobId: 2,
      decision: "ignore",
      decisionReason: "Ignored from the review queue after user review.",
      matchScore: 82,
      riskLevel: "low",
      reviewRequired: false,
    });

    const applications = await getUserApplications(userId);
    const artifacts = await getApplicationLedgerArtifacts(applicationId, userId);
    const pendingApprovals = await listUserApplicationApprovals(userId, "pending");
    const allApprovals = await listUserApplicationApprovals(userId, "all");
    const ledger = await getUserOperatingLedger(userId);

    expect(applications.find((application) => application.id === applicationId)?.status).toBe("withdrawn");
    expect(pendingApprovals.filter((approval) => approval.applicationId === applicationId)).toHaveLength(0);
    expect(allApprovals.find((approval) => approval.applicationId === applicationId)?.status).toBe("cancelled");
    expect(artifacts.attempts.some((attempt) =>
      attempt.attemptType === "external_handoff" &&
      attempt.status === "cancelled" &&
      attempt.confirmationText?.includes("prepared submission gate cancelled")
    )).toBe(true);
    expect(artifacts.auditEvents.some((event) =>
      event.action === "application_review_closed" &&
      event.afterState?.includes("\"status\":\"withdrawn\"")
    )).toBe(true);
    expect(ledger.metrics.pendingApprovals).toBe(0);
    expect(ledger.metrics.reviewRequiredDecisions).toBe(0);
  });
});
