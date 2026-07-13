import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { COOKIE_NAME } from "../shared/const";
import { getUserOperatingLedger } from "./applicationCampaigns";
import {
  getAdminReviewEvidenceSnapshot,
  getApplicationLedgerArtifacts,
  getUserApplications,
  getUserOfferAttributionReviews,
  getUserSuccessFees,
} from "./db";
import {
  DEV_ADMIN_EMAIL,
  DEV_ADMIN_OPEN_ID,
  DEV_REVIEW_QUEUE_EMAIL,
  seedDevReviewQueueUser,
} from "./devReviewQueueSeed";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";

describe("development review queue seed", () => {
  it("restores a seeded local admin session without attempting unavailable OAuth", async () => {
    ENV.cookieSecret = "dev-review-queue-test-secret";
    ENV.appId = "dev-review-queue-test-app";
    ENV.oAuthServerUrl = "";

    const sessionToken = await sdk.createSessionToken(DEV_ADMIN_OPEN_ID, {
      name: "Admin QA",
    });

    const authenticatedUser = await sdk.authenticateRequest({
      headers: {
        cookie: `${COOKIE_NAME}=${sessionToken}`,
      },
    } as Request);

    expect(authenticatedUser.openId).toBe(DEV_ADMIN_OPEN_ID);
    expect(authenticatedUser.email).toBe(DEV_ADMIN_EMAIL);
    expect(authenticatedUser.role).toBe("admin");
  });

  it("creates an authenticatable user with visible operating queue data", async () => {
    ENV.cookieSecret = "dev-review-queue-test-secret";
    ENV.appId = "dev-review-queue-test-app";

    const user = await seedDevReviewQueueUser();
    const sessionToken = await sdk.createSessionToken(user.openId, {
      name: user.name || "Review Queue QA",
    });

    const authenticatedUser = await sdk.authenticateRequest({
      headers: {
        cookie: `${COOKIE_NAME}=${sessionToken}`,
      },
    } as Request);
    const ledger = await getUserOperatingLedger(authenticatedUser.id);
    const adminLedger = await getUserOperatingLedger(authenticatedUser.id, { includeAdminReviews: true });
    const applications = await getUserApplications(authenticatedUser.id);
    const preparedApplication = applications.find((application) => application.jobId === 1);
    const respondedApplication = applications.find((application) => application.jobId === 2);
    const questionApplication = applications.find((application) => application.jobId === 3);
    const followUpApplication = applications.find((application) => application.jobId === 4);
    const artifacts = await getApplicationLedgerArtifacts(preparedApplication!.id, authenticatedUser.id);
    const respondedArtifacts = await getApplicationLedgerArtifacts(respondedApplication!.id, authenticatedUser.id);
    const followUpArtifacts = await getApplicationLedgerArtifacts(followUpApplication!.id, authenticatedUser.id);
    const reviewEvidence = await getAdminReviewEvidenceSnapshot(adminLedger.queues.adminReviews[0].id);
    const successFees = await getUserSuccessFees(authenticatedUser.id);
    const offerAttributionReviews = await getUserOfferAttributionReviews(authenticatedUser.id);

    expect(authenticatedUser.email).toBe(DEV_REVIEW_QUEUE_EMAIL);
    expect(ledger.queues.pendingApprovals).toHaveLength(2);
    expect(ledger.metrics.reviewRequiredDecisions).toBeGreaterThanOrEqual(1);
    expect(ledger.metrics.employerResponsesNeedingReply).toBeGreaterThanOrEqual(1);
    expect(ledger.queues.employerResponsesNeedingReply.some((item) =>
      item.applicationId === questionApplication!.id &&
      item.responseType === "employer_question"
    )).toBe(true);
    expect(ledger.metrics.followUpsDue).toBe(0);
    expect(ledger.metrics.approvedFollowUpsReadyToSend).toBeGreaterThanOrEqual(1);
    expect(ledger.queues.approvedFollowUpsReadyToSend.some((item) =>
      item.applicationId === followUpApplication!.id &&
      item.jobId === 4 &&
      item.purpose === "routine_follow_up"
    )).toBe(true);
    expect(ledger.queues.adminReviews).toHaveLength(0);
    expect(ledger.canReviewAdminItems).toBe(false);
    expect(adminLedger.queues.adminReviews).toHaveLength(1);
    expect(adminLedger.canReviewAdminItems).toBe(true);
    expect(reviewEvidence.reviewItem.entityId).toBe(preparedApplication!.id);
    expect(reviewEvidence.user?.email).toBe(DEV_REVIEW_QUEUE_EMAIL);
    expect(reviewEvidence.application?.id).toBe(preparedApplication!.id);
    expect(reviewEvidence.decision).toMatchObject({
      jobId: 1,
      decision: "review",
      matchScore: 91,
      riskLevel: "high",
      reviewRequired: 1,
    });
    expect(reviewEvidence.decision?.reviewReason).toContain("External application submission is blocked");
    expect(reviewEvidence.material?.claimsMade).toContain("supportedClaimsOnly");
    expect(reviewEvidence.approvals.map((approval) => approval.approvalType)).toEqual(
      expect.arrayContaining(["application_submission"])
    );
    expect(reviewEvidence.auditEvents.map((event) => event.action)).toEqual(
      expect.arrayContaining(["application_prepared_for_review", "approval_requested"])
    );
    expect(ledger.readiness.blockers.some((gap) => gap.key === "resume")).toBe(true);
    expect(ledger.metrics.evidenceGates).toBeGreaterThan(0);
    expect(ledger.queues.evidenceGates.map((gate) => gate.id)).toContain("profile-core-evidence");
    expect(artifacts.material?.claimsMade).toContain("supportedClaimsOnly");
    expect(artifacts.material?.sourceProfileSnapshot).toContain("devReviewQueueSeed");
    expect(respondedArtifacts.auditEvents.some((event) =>
      event.action === "stale_follow_up_approvals_cancelled" &&
      event.afterState?.includes("interview_invite")
    )).toBe(true);
    expect(offerAttributionReviews).toHaveLength(1);
    expect(offerAttributionReviews[0]).toMatchObject({
      application: { id: respondedApplication!.id },
      latestEmployerResponse: {
        responseType: "offer",
        summary: "Recruiter sent a written remote offer with salary and start-date details.",
      },
      payload: { responseType: "offer" },
    });
    expect(followUpArtifacts.auditEvents.some((event) =>
      event.action === "application_follow_up_due_seeded"
    )).toBe(true);
    expect(successFees.some((fee) =>
      fee.employerName === "QA Success Employer" &&
      fee.status === "active" &&
      fee.stripeSubscriptionId === "sub_dev_success_fee"
    )).toBe(true);
  });
});
