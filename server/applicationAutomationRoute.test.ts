import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getActiveResume: vi.fn(),
}));

vi.mock("./resumeStorage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./resumeStorage")>()),
  getActiveResume: mocks.getActiveResume,
}));
import {
  getApplicationLedgerArtifacts,
  getAuditEventsForEntity,
  getAuditEventsForUser,
  getUserApplicationDecisions,
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
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getActiveResume.mockResolvedValue({
      id: 73501,
      userId: 98401,
      fileName: "alex-resume.pdf",
      fileUrl: "https://storage.example.local/resumes/98401/alex-resume.pdf",
      fileKey: "resumes/98401/alex-resume.pdf",
      fileSize: 1234,
      mimeType: "application/pdf",
      version: 3,
      isActive: true,
      uploadedAt: new Date(),
    });
  });

  it("records a reviewable preparation rather than an applied submission", async () => {
    const userId = 98401;
    await upsertUserProfile({
      userId,
      resumeUrl: "https://example.com/resume.pdf",
      skills: "TypeScript, React, Node.js",
      experience: "Five years building production web applications.",
      desiredJobTypes: "Frontend Engineer",
      desiredLocations: "Remote, worldwide",
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
    expect(artifacts.material).toMatchObject({ resumeId: 73501 });
    expect(
      auditEvents.some(
        event => {
          if (event.action !== "application_prepared_by_automation" || !event.afterState) {
            return false;
          }
          const afterState = JSON.parse(event.afterState) as {
            externalSubmissionPerformed?: boolean;
            resume?: { id?: number };
          };
          return afterState.externalSubmissionPerformed === false && afterState.resume?.id === 73501;
        }
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

  it("refuses preparation when the user has no active versioned resume", async () => {
    const userId = 98402;
    mocks.getActiveResume.mockResolvedValueOnce(null);
    await upsertUserProfile({
      userId,
      resumeUrl: "https://example.com/legacy-resume.pdf",
      resumeFileKey: "resumes/98402/legacy-resume.pdf",
    });

    const caller = appRouter.createCaller(createContext(userId));

    await expect(caller.automation.applyToJob({ jobId: 1 })).rejects.toThrow(
      "active versioned resume"
    );
    expect(await getUserApplications(userId)).toHaveLength(0);
  });

  it("refuses direct preparation when core profile evidence is incomplete", async () => {
    const userId = 98403;
    await upsertUserProfile({
      userId,
      resumeUrl: "https://example.com/resume.pdf",
    });
    const caller = appRouter.createCaller(createContext(userId));

    await expect(caller.automation.applyToJob({ jobId: 1 })).rejects.toThrow(
      "Core profile evidence is required"
    );
    await expect(caller.applications.create({ jobId: 1 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("Core profile evidence is required"),
    });
    expect(await getUserApplications(userId)).toHaveLength(0);
    expect(await listUserApplicationApprovals(userId, "all")).toHaveLength(0);
  });

  it("records a blocked decision without creating application materials", async () => {
    const userId = 98404;
    await upsertUserProfile({
      userId,
      resumeUrl: "https://example.com/resume.pdf",
    });
    const caller = appRouter.createCaller(createContext(userId));

    const result = await caller.applications.decide({
      jobId: 1,
      decision: "review",
      decisionReason: "This role should be considered once the candidate profile is complete.",
      reviewRequired: true,
    });
    const decisions = await getUserApplicationDecisions(userId);
    const auditEvents = await getAuditEventsForUser(userId, 10);

    expect(result).toMatchObject({
      success: true,
      applicationRecordId: null,
      preparationBlocked: true,
    });
    expect(decisions).toHaveLength(1);
    expect(await getUserApplications(userId)).toHaveLength(0);
    expect(await listUserApplicationApprovals(userId, "all")).toHaveLength(0);
    expect(auditEvents.some((event) =>
      event.action === "application_preparation_blocked_profile_readiness" &&
      event.afterState?.includes("Experience missing") &&
      event.afterState?.includes("Target roles missing")
    )).toBe(true);
  });
});
