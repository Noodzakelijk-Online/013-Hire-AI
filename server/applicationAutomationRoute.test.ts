import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import {
  getApplicationLedgerArtifacts,
  getAuditEventsForEntity,
  getUserApplications,
  listUserApplicationApprovals,
  upsertUserProfile,
} from "./db";
import { appRouter } from "./routers";

function createContext(userId: number): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `automation-user-${userId}`,
      name: "Automation User",
      email: `automation-${userId}@example.local`,
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

describe("automation application preparation route", () => {
  it("records a reviewable preparation rather than an applied submission", async () => {
    const userId = 98401;
    await upsertUserProfile({
      userId,
      resumeUrl: "https://example.com/resume.pdf",
    });
    const caller = appRouter.createCaller(createContext(userId));

    const result = await caller.automation.applyToJob({ jobId: 1 });
    const applications = await getUserApplications(userId);
    const application = applications.find(
      item => item.id === result.applicationRecordId
    );
    const artifacts = await getApplicationLedgerArtifacts(
      result.applicationRecordId,
      userId
    );
    const auditEvents = await getAuditEventsForEntity(
      userId,
      "application",
      result.applicationRecordId
    );
    const approvals = await listUserApplicationApprovals(userId, "pending");

    expect(result.success).toBe(false);
    expect(application).toMatchObject({
      status: "pending",
      appliedDate: undefined,
      isAutoApplied: 0,
    });
    expect(artifacts.attempts[0]).toMatchObject({
      attemptType: "prepare",
      status: "review_required",
    });
    expect(
      auditEvents.some(
        event =>
          event.action === "application_prepared_by_automation" &&
          event.afterState?.includes('"externalSubmissionPerformed":false')
      )
    ).toBe(true);
    expect(
      auditEvents.some(
        event => event.action === "application_submitted_by_automation"
      )
    ).toBe(false);
    expect(
      approvals.some(
        approval =>
          approval.applicationId === result.applicationRecordId &&
          approval.approvalType === "application_submission"
      )
    ).toBe(true);
  });
});
