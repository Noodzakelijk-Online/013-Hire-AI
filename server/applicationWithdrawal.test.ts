import type { TrpcContext } from "./_core/context";
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { createApplication, createApplicationApproval, getApplicationLedgerArtifacts, listUserApplicationApprovals, resolveApplicationApproval } from "./db";
import { createFollowUp, markFollowUpSent } from "./applicationFeatures";

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
      "Follow-up approval is required before marking it sent."
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
});
