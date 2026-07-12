import type { TrpcContext } from "./_core/context";
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { createAdminReviewItem, createApplication, createApplicationApproval, getApplicationLedgerArtifacts, getUserApplications, listAdminReviewItems, listUserApplicationApprovals, resolveApplicationApproval } from "./db";
import { createFollowUp, getInterviewSchedules, getUpcomingInterviews, markFollowUpSent, scheduleInterview } from "./applicationFeatures";

function createContext(userId: number): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `withdrawal-user-${userId}`,
      name: "Withdrawal User",
      email: `withdrawal-${userId}@example.local`,
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

describe("application withdrawal", () => {
  it("cancels unsent external actions and records the outcome through the public withdrawal path", async () => {
    const userId = 98301;
    const application = await createApplication({
      userId,
      jobId: 2,
      status: "applied",
      notes: "Submitted application with pending actions.",
    });
    const applicationId = Number(application.insertId);
    const submissionApproval = await createApplicationApproval({
      userId,
      applicationId,
      entityType: "application",
      entityId: applicationId,
      approvalType: "application_submission",
      status: "pending",
      riskLevel: "high",
      requestedBy: "system",
      decidedBy: null,
      title: "External application handoff",
      description: "A submission handoff is waiting for confirmation.",
      payload: null,
      decidedAt: null,
    });
    const followUp = await createFollowUp({
      applicationId,
      message: "I wanted to check whether there is an update on my application.",
    }, userId);
    const followUpApproval = (await listUserApplicationApprovals(userId, "pending")).find((approval) =>
      approval.entityType === "follow_up" && approval.entityId === followUp.id
    );
    expect(followUpApproval).toBeTruthy();
    await resolveApplicationApproval(
      followUpApproval!.id,
      userId,
      "approved",
      "Approved before the application was withdrawn.",
      "user"
    );

    const caller = appRouter.createCaller(createContext(userId));
    await caller.applications.updateStatus({ applicationId, status: "withdrawn" });

    const approvals = await listUserApplicationApprovals(userId, "all");
    expect(approvals.find((approval) => approval.id === Number(submissionApproval.insertId))?.status).toBe("cancelled");
    expect(approvals.find((approval) => approval.id === followUpApproval!.id)?.status).toBe("cancelled");
    await expect(markFollowUpSent(followUp.id, userId)).rejects.toThrow(
      "Follow-ups can only be created after an application has been submitted."
    );

    const artifacts = await getApplicationLedgerArtifacts(applicationId, userId);
    expect(artifacts.attempts.some((attempt) =>
      attempt.attemptType === "external_handoff" &&
      attempt.status === "cancelled" &&
      attempt.confirmationText?.includes(String(submissionApproval.insertId))
    )).toBe(true);
    expect(artifacts.auditEvents.some((event) =>
      event.action === "application_external_actions_cancelled" &&
      event.afterState?.includes(String(followUpApproval!.id))
    )).toBe(true);
    expect(artifacts.auditEvents.some((event) =>
      event.action === "application_status_updated" &&
      event.afterState?.includes("withdrawn")
    )).toBe(true);
  });

  it("records an explicit offer decline and cancels pending attribution review", async () => {
    const userId = 98302;
    const application = await createApplication({
      userId,
      jobId: 3,
      status: "offer",
      notes: "Employer made an offer that needs an explicit user decision.",
    });
    const applicationId = Number(application.insertId);
    const attributionApproval = await createApplicationApproval({
      userId,
      applicationId,
      entityType: "application",
      entityId: applicationId,
      approvalType: "offer_attribution",
      status: "pending",
      riskLevel: "high",
      requestedBy: "system",
      decidedBy: null,
      title: "Confirm offer attribution",
      description: "Review whether the offer resulted from this application.",
      payload: null,
      decidedAt: null,
    });
    const attributionReview = await createAdminReviewItem({
      userId,
      entityType: "application",
      entityId: applicationId,
      category: "offer_attribution",
      priority: "high",
      title: "Offer attribution needs review",
      description: "Review this offer before success-fee work proceeds.",
    });

    const caller = appRouter.createCaller(createContext(userId));
    await caller.applications.declineOffer({
      applicationId,
      confirmed: true,
      declineNote: "Declined after reviewing the written offer terms.",
    });

    expect((await getUserApplications(userId)).find((item) => item.id === applicationId)?.status).toBe("withdrawn");
    expect((await listUserApplicationApprovals(userId, "all")).find((approval) =>
      approval.id === Number(attributionApproval.insertId)
    )?.status).toBe("cancelled");
    const dismissedReview = (await listAdminReviewItems("all")).find((review) =>
      review.id === Number(attributionReview.insertId)
    );
    expect(dismissedReview?.status).toBe("dismissed");
    expect(dismissedReview?.resolution).toContain("explicitly declined");
    const artifacts = await getApplicationLedgerArtifacts(applicationId, userId);
    expect(artifacts.auditEvents.some((event) =>
      event.action === "offer_declined" &&
      event.afterState?.includes("externalCommunicationSent\":false") &&
      event.afterState?.includes(String(attributionReview.insertId))
    )).toBe(true);
    expect(artifacts.auditEvents.some((event) =>
      event.action === "application_external_actions_cancelled" &&
      event.afterState?.includes(String(attributionApproval.insertId))
    )).toBe(true);
  });

  it("retires scheduled interviews when a user withdraws an interview-stage application", async () => {
    const userId = 98303;
    const application = await createApplication({
      userId,
      jobId: 2,
      status: "interview",
      notes: "Candidate needs to withdraw before the scheduled interview.",
    });
    const applicationId = Number(application.insertId);
    const interview = await scheduleInterview({
      applicationId,
      interviewType: "video",
      scheduledAt: new Date(Date.now() + 3 * 86400000),
    }, userId);

    expect((await getUpcomingInterviews(userId)).some((item) => item.interview.id === interview.id)).toBe(true);

    const caller = appRouter.createCaller(createContext(userId));
    await caller.applications.updateStatus({ applicationId, status: "withdrawn" });

    expect((await getUserApplications(userId)).find((item) => item.id === applicationId)?.status).toBe("withdrawn");
    expect((await getInterviewSchedules(applicationId, userId)).find((item) => item.id === interview.id)?.status).toBe("cancelled");
    expect((await getUpcomingInterviews(userId)).some((item) => item.interview.id === interview.id)).toBe(false);

    const artifacts = await getApplicationLedgerArtifacts(applicationId, userId);
    expect(artifacts.auditEvents.some((event) =>
      event.action === "interviews_cancelled_after_application_withdrawal" &&
      event.afterState?.includes(String(interview.id)) &&
      event.afterState?.includes("externalCancellationSent\":false")
    )).toBe(true);
  });
});
