import { describe, expect, it } from "vitest";
import {
  createApplication,
  createEmployerResponse,
  getApplicationLedgerArtifacts,
  getAuditEventsForEntity,
  getAuditEventsForUser,
  getUserApplications,
  listAdminReviewItems,
  listUserApplicationApprovals,
  upsertUserProfile,
} from "./db";
import { getFollowUps } from "./applicationFeatures";
import { runAutonomousForUser } from "./autonomousService";

describe("autonomous submission approval gates", () => {
  it("creates submission approvals for queued autonomous application records", async () => {
    const userId = 99101;

    await upsertUserProfile({
      userId,
      skills: "React, TypeScript, Node.js",
      experience: "Five years building production web applications.",
      desiredJobTypes: "full-time",
      desiredLocations: "remote, worldwide",
      salaryExpectationMin: 50000,
      resumeUrl: "https://example.com/resume.pdf",
      preferences: JSON.stringify({
        autonomousEnabled: true,
        mode: "review_first",
        minMatchScore: 0,
        dailyApplicationLimit: 1,
        createFollowUps: false,
      }),
    });

    const result = await runAutonomousForUser(userId, { dailyApplicationLimit: 1, minMatchScore: 0 });
    const applications = await getUserApplications(userId);
    const approvals = await listUserApplicationApprovals(userId, "pending");
    const applicationId = applications[0].id;
    const ledger = await getApplicationLedgerArtifacts(applicationId, userId);
    const auditEvents = await getAuditEventsForUser(userId, 10);
    const adminReviews = await listAdminReviewItems("all");

    expect(result.queuedReviewRecords + result.queuedApplicationRecords + result.queuedManualRecords).toBeGreaterThan(0);
    expect(applications.length).toBeGreaterThan(0);
    expect(approvals.some((approval) =>
      approval.approvalType === "application_submission" &&
      approval.entityType === "application" &&
      approval.applicationId === applicationId
    )).toBe(true);
    expect(ledger.material?.sourceProfileSnapshot).toContain("autonomousService");
    expect(ledger.material?.claimsMade).toContain("No qualifications");
    expect(ledger.attempts[0].status).toBe("review_required");
    expect(ledger.attempts[0].confirmationText).toContain("No external submission was performed");
    expect(ledger.auditEvents.some((event) =>
      event.action.startsWith("autonomous_") &&
      event.approvalId === approvals[0].id
    )).toBe(true);
    expect(auditEvents.some((event) => event.entityId === applicationId && event.source === "autonomousService")).toBe(true);
    expect(adminReviews.some((review) =>
      review.userId === userId &&
      review.entityType === "application" &&
      review.entityId === applicationId &&
      review.category === "application_review"
    )).toBe(true);
  });

  it("does not draft routine follow-ups while an employer response needs review", async () => {
    const userId = 99102;
    const staleDate = new Date(Date.now() - 8 * 86400000);

    await upsertUserProfile({
      userId,
      skills: "React, TypeScript",
      experience: "Five years building production web applications.",
      desiredJobTypes: "full-time",
      desiredLocations: "remote",
      preferences: JSON.stringify({
        autonomousEnabled: true,
        minMatchScore: 100,
        dailyApplicationLimit: 1,
        createFollowUps: true,
      }),
    });

    const application = await createApplication({
      userId,
      jobId: 2,
      status: "applied",
      appliedDate: staleDate,
      lastActivity: staleDate,
      notes: "Submitted application with an unresolved employer question.",
    });
    const applicationId = Number(application.insertId);
    await createEmployerResponse({
      userId,
      applicationId,
      responseType: "employer_question",
      source: "email",
      summary: "Recruiter asked for availability and salary expectations.",
      receivedAt: new Date(),
      statusBefore: "applied",
      statusAfter: "viewed",
      noteId: null,
    });

    const result = await runAutonomousForUser(userId, {
      createFollowUps: true,
      minMatchScore: 100,
      dailyApplicationLimit: 1,
    });
    const followUps = await getFollowUps(applicationId, userId);
    const auditEvents = await getAuditEventsForEntity(userId, "application", applicationId);

    expect(result.queuedFollowUps).toBe(0);
    expect(result.skippedSafetyBlockedFollowUps).toBe(1);
    expect(followUps).toHaveLength(0);
    expect(auditEvents.some((event) =>
      event.action === "autonomous_follow_up_safety_blocked" &&
      event.afterState?.includes("Employer response needs a reply")
    )).toBe(true);
  });
});
