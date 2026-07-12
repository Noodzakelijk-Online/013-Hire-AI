import { describe, expect, it } from "vitest";
import { confirmApplicationSubmission } from "./applicationFeatures";
import {
  createApplication,
  createApplicationApproval,
  getApplicationLedgerArtifacts,
  getUserApplications,
  listUserApplicationApprovals,
} from "./db";

describe("submission confirmation memory fallback", () => {
  it("confirms a pending application only with evidence, approval, attempt, and audit records", async () => {
    const userId = 98301;
    const application = await createApplication({
      userId,
      jobId: 1,
      status: "pending",
      notes: "Prepared application awaiting explicit submission evidence.",
    });
    const applicationId = Number(application.insertId);
    const approval = await createApplicationApproval({
      userId,
      applicationId,
      entityType: "application",
      entityId: applicationId,
      approvalType: "application_submission",
      status: "pending",
      riskLevel: "high",
      requestedBy: "system",
      title: "Approve prepared external submission",
      description: "Prepared materials require explicit approval before external handoff.",
    });

    const result = await confirmApplicationSubmission({
      applicationId,
      source: "employer_portal",
      evidence: "Employer portal displayed Application submitted with confirmation ID QA-98301.",
      confirmationUrl: "https://boards.example.local/applications/QA-98301",
    }, userId);

    expect(result.status).toBe("applied");
    expect(result.evidenceAttemptId).toBeTruthy();

    const applications = await getUserApplications(userId);
    expect(applications.find((item) => item.id === applicationId)?.status).toBe("applied");

    const approvals = await listUserApplicationApprovals(userId, "all");
    const resolvedApproval = approvals.find((item) => item.id === Number(approval.insertId));
    expect(resolvedApproval?.status).toBe("approved");
    expect(resolvedApproval?.decisionNote).toBe("Approved through manual submission evidence confirmation.");

    const artifacts = await getApplicationLedgerArtifacts(applicationId, userId);
    const submissionAttempt = artifacts.attempts.find((attempt) =>
      attempt.id === result.evidenceAttemptId
    );
    expect(submissionAttempt?.attemptType).toBe("manual_confirmation");
    expect(submissionAttempt?.status).toBe("submitted");
    expect(submissionAttempt?.confirmationText).toContain("Application submitted");
    expect(submissionAttempt?.confirmationUrl).toBe("https://boards.example.local/applications/QA-98301");
    expect(artifacts.auditEvents.some((event) =>
      event.action === "application_submission_confirmed" &&
      event.approvalId === Number(approval.insertId) &&
      event.afterState?.includes(`"attemptId":${result.evidenceAttemptId}`)
    )).toBe(true);
  });

  it("creates an approved submission approval when manual evidence is confirmed without a pending gate", async () => {
    const userId = 98302;
    const application = await createApplication({
      userId,
      jobId: 2,
      status: "pending",
      notes: "Manual evidence should create the explicit approval record.",
    });
    const applicationId = Number(application.insertId);

    await confirmApplicationSubmission({
      applicationId,
      source: "manual",
      evidence: "User manually confirmed the application was submitted after completing the employer form.",
    }, userId);

    const approvals = await listUserApplicationApprovals(userId, "all");
    expect(approvals.some((approval) =>
      approval.applicationId === applicationId &&
      approval.approvalType === "application_submission" &&
      approval.status === "approved" &&
      approval.riskLevel === "high"
    )).toBe(true);
  });

  it("blocks confirmation when the submission approval was rejected", async () => {
    const userId = 98303;
    const application = await createApplication({
      userId,
      jobId: 3,
      status: "pending",
      notes: "Rejected approval must block later evidence confirmation.",
    });
    const applicationId = Number(application.insertId);
    await createApplicationApproval({
      userId,
      applicationId,
      entityType: "application",
      entityId: applicationId,
      approvalType: "application_submission",
      status: "rejected",
      riskLevel: "high",
      requestedBy: "system",
      decidedBy: "user",
      title: "Prepared submission rejected",
      description: "User rejected this submission.",
      decisionNote: "Do not submit this application.",
      decidedAt: new Date(),
    });

    await expect(confirmApplicationSubmission({
      applicationId,
      source: "manual",
      evidence: "User now says the application was submitted.",
    }, userId)).rejects.toThrow("approval was rejected or cancelled");

    const applications = await getUserApplications(userId);
    expect(applications.find((item) => item.id === applicationId)?.status).toBe("pending");
  });

  it("keeps exact submission-confirmation retries idempotent", async () => {
    const userId = 98305;
    const application = await createApplication({
      userId,
      jobId: 5,
      status: "pending",
      notes: "Prepared application awaiting deterministic submission evidence.",
    });
    const applicationId = Number(application.insertId);
    const input = {
      applicationId,
      source: "ats_confirmation" as const,
      evidence: "The ATS displayed confirmation number QA-98305 after the employer form was submitted.",
      confirmationUrl: "https://boards.example.local/applications/QA-98305",
    };

    const first = await confirmApplicationSubmission(input, userId);
    const retry = await confirmApplicationSubmission(input, userId);
    const artifacts = await getApplicationLedgerArtifacts(applicationId, userId);

    expect(retry).toMatchObject({
      success: true,
      status: "applied",
      evidenceAttemptId: first.evidenceAttemptId,
      existing: true,
    });
    expect(artifacts.attempts.filter((attempt) =>
      attempt.attemptType === "manual_confirmation" && attempt.status === "submitted"
    )).toHaveLength(1);
    expect(artifacts.auditEvents.filter((event) =>
      event.action === "application_submission_confirmed"
    )).toHaveLength(1);

    await expect(confirmApplicationSubmission({
      ...input,
      evidence: "A different confirmation record was pasted after the first submission proof was already stored.",
    }, userId)).rejects.toThrow("already confirmed");
  });

  it("validates evidence before changing application state", async () => {
    const userId = 98304;
    const application = await createApplication({
      userId,
      jobId: 4,
      status: "pending",
      notes: "Vague evidence should not alter the ledger.",
    });
    const applicationId = Number(application.insertId);

    await expect(confirmApplicationSubmission({
      applicationId,
      source: "manual",
      evidence: "done",
    }, userId)).rejects.toThrow("Submission evidence must describe");

    const applications = await getUserApplications(userId);
    expect(applications.find((item) => item.id === applicationId)?.status).toBe("pending");
    const artifacts = await getApplicationLedgerArtifacts(applicationId, userId);
    expect(artifacts.attempts).toHaveLength(0);
    expect(artifacts.auditEvents.some((event) => event.action === "application_submission_confirmed")).toBe(false);
  });
});
