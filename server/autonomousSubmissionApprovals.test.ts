import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActiveResume: vi.fn(),
  getActiveJobs: vi.fn(),
  getJobById: vi.fn(),
}));

vi.mock("./resumeStorage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./resumeStorage")>()),
  getActiveResume: mocks.getActiveResume,
}));

vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./db")>()),
  getActiveJobs: mocks.getActiveJobs,
  getJobById: mocks.getJobById,
}));

import {
  createApplication,
  createApplicationDecision,
  createEmployerResponse,
  getApplicationLedgerArtifacts,
  getAuditEventsForEntity,
  getAuditEventsForUser,
  getUserJobMatches,
  getUserApplicationDecisions,
  getUserApplications,
  listAdminReviewItems,
  listUserApplicationApprovals,
  touchApplicationActivity,
  getUserByOpenId,
  upsertUser,
  upsertUserProfile,
} from "./db";
import { getFollowUps, recordEmployerResponse, recordInterviewOutcome, scheduleInterview, updateInterviewStatus } from "./applicationFeatures";
import { runAutonomousForUser } from "./autonomousService";
import { sampleJobs } from "./sampleData";

async function createEligibleTestUser(label: string) {
  const openId = `autonomous-submission-${label}`;
  await upsertUser({
    openId,
    email: `${label}@example.local`,
    accountStatus: "active",
    tosAcceptedAt: new Date(),
  });
  const user = await getUserByOpenId(openId);
  if (!user) throw new Error("Unable to create autonomous test user.");
  return user.id;
}

async function recordInterviewInvite(applicationId: number, userId: number) {
  await recordEmployerResponse({
    applicationId,
    responseType: "interview_invite",
    source: "email",
    summary: "Recruiter invited the candidate to a video interview.",
  }, userId);
}

describe("autonomous submission approval gates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getActiveResume.mockImplementation(async (userId: number) => ({
      id: 98000 + userId,
      userId,
      fileName: "active-resume.pdf",
      fileUrl: `https://storage.example.local/resumes/${userId}/active-resume.pdf`,
      fileKey: `resumes/${userId}/active-resume.pdf`,
      fileSize: 1024,
      mimeType: "application/pdf",
      version: 2,
      isActive: true,
      uploadedAt: new Date(),
    }));
    mocks.getActiveJobs.mockResolvedValue([sampleJobs[0]]);
    mocks.getJobById.mockImplementation(async (jobId: number) =>
      sampleJobs.find((job) => job.id === jobId)
    );
  });

  it("creates submission approvals for queued autonomous application records", async () => {
    const userId = await createEligibleTestUser("99101");

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
    const matches = await getUserJobMatches(userId, 0);

    expect(result.queuedReviewRecords + result.queuedApplicationRecords + result.queuedManualRecords).toBeGreaterThan(0);
    expect(applications.length).toBeGreaterThan(0);
    expect(applications[0].coverLetter).toContain("this draft references only those recorded skills");
    expect(approvals.some((approval) =>
      approval.approvalType === "application_submission" &&
      approval.entityType === "application" &&
      approval.applicationId === applicationId
    )).toBe(true);
    expect(ledger.material?.sourceProfileSnapshot).toContain("autonomousService");
    expect(ledger.material?.resumeId).toBe(98000 + userId);
    expect(ledger.material?.coverLetter).toContain("this draft references only those recorded skills");
    expect(ledger.material?.claimsMade).toContain("makes no claims about qualifications");
    expect(ledger.material?.claimsMade).toContain("supportedSkills");
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
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      jobId: sampleJobs[0].id,
      matchReasons: expect.stringContaining("Autonomous profile match."),
    });
  });

  it("keeps preparation evidence idempotent when the same autonomous run is retried", async () => {
    const userId = await createEligibleTestUser("99104");
    const job = sampleJobs[0];

    await upsertUserProfile({
      userId,
      skills: "React, TypeScript, Node.js",
      experience: "Five years building production web applications.",
      desiredJobTypes: "full-time",
      desiredLocations: "remote, worldwide",
      resumeUrl: "https://example.com/resume.pdf",
      preferences: JSON.stringify({
        autonomousEnabled: true,
        mode: "review_first",
        minMatchScore: 0,
        dailyApplicationLimit: 1,
      }),
    });

    const existingPreparation = await createApplication({
      userId,
      jobId: job.id,
      status: "pending",
      notes: "Preparation was interrupted before review artifacts were written.",
      isAutoApplied: 0,
    });

    await runAutonomousForUser(userId, { dailyApplicationLimit: 2, minMatchScore: 0 });
    await runAutonomousForUser(userId, { dailyApplicationLimit: 2, minMatchScore: 0 });

    const applications = await getUserApplications(userId);
    const applicationId = applications[0].id;
    const artifacts = await getApplicationLedgerArtifacts(applicationId, userId);
    const approvals = await listUserApplicationApprovals(userId, "pending");
    const adminReviews = await listAdminReviewItems("all");
    const matches = await getUserJobMatches(userId, 0);
    const preparationEvents = artifacts.auditEvents.filter((event) =>
      event.action.startsWith("autonomous_") && event.approvalId === approvals[0].id
    );

    expect(applications).toHaveLength(1);
    expect(applicationId).toBe(Number(existingPreparation.insertId));
    expect(approvals).toHaveLength(1);
    expect(artifacts.attempts.filter((attempt) => attempt.status === "review_required")).toHaveLength(1);
    expect(preparationEvents).toHaveLength(1);
    expect(adminReviews.filter((review) =>
      review.userId === userId &&
      review.entityType === "application" &&
      review.entityId === applicationId &&
      review.category === "application_review"
    )).toHaveLength(1);
    expect(matches.filter((match) => match.jobId === job.id)).toHaveLength(1);
  });

  it("rechecks a listing before writing autonomous preparation records", async () => {
    const userId = await createEligibleTestUser("99109");
    mocks.getJobById.mockResolvedValue({ ...sampleJobs[0], isActive: 0 });
    await upsertUserProfile({
      userId,
      skills: "React, TypeScript, Node.js",
      experience: "Five years building production web applications.",
      desiredJobTypes: "full-time",
      desiredLocations: "remote, worldwide",
      resumeUrl: "https://example.com/resume.pdf",
      preferences: JSON.stringify({
        autonomousEnabled: true,
        mode: "review_first",
        minMatchScore: 0,
        dailyApplicationLimit: 1,
      }),
    });

    const result = await runAutonomousForUser(userId, { dailyApplicationLimit: 1, minMatchScore: 0 });
    const auditEvents = await getAuditEventsForUser(userId, 10);

    expect(result.skippedStaleJobActions).toBe(1);
    expect(result.queuedReviewRecords + result.queuedApplicationRecords + result.queuedManualRecords).toBe(0);
    expect(await getUserApplications(userId)).toHaveLength(0);
    expect(auditEvents.some((event) =>
      event.action === "autonomous_application_preparation_blocked_stale_job" &&
      event.afterState?.includes(`"jobId":${sampleJobs[0].id}`) &&
      event.afterState?.includes('"externalSubmissionPerformed":false')
    )).toBe(true);
  });

  it("keeps a blocked high-fit job visible as a review decision without creating an application", async () => {
    const userId = await createEligibleTestUser("99111");
    mocks.getActiveResume.mockResolvedValue(null);
    await upsertUserProfile({
      userId,
      skills: "React, TypeScript, Node.js",
      experience: "Five years building production web applications.",
      desiredJobTypes: "full-time",
      desiredLocations: "remote, worldwide",
      preferences: JSON.stringify({
        autonomousEnabled: true,
        mode: "review_first",
        minMatchScore: 0,
        dailyApplicationLimit: 1,
      }),
    });

    const result = await runAutonomousForUser(userId, { dailyApplicationLimit: 1, minMatchScore: 0 });
    const decisions = await getUserApplicationDecisions(userId);

    expect(result.summary.blocked).toBe(1);
    expect(await getUserApplications(userId)).toHaveLength(0);
    expect(decisions).toEqual([expect.objectContaining({
      jobId: sampleJobs[0].id,
      decision: "review",
      riskLevel: "high",
      reviewRequired: 1,
      reviewReason: expect.stringContaining("Resume is required"),
    })]);
  });

  it("does not replace an explicit user job decision with an autonomous terminal outcome", async () => {
    const userId = await createEligibleTestUser("99112");
    mocks.getActiveResume.mockResolvedValue(null);
    await upsertUserProfile({
      userId,
      skills: "React, TypeScript, Node.js",
      experience: "Five years building production web applications.",
      desiredJobTypes: "full-time",
      desiredLocations: "remote, worldwide",
      preferences: JSON.stringify({
        autonomousEnabled: true,
        mode: "review_first",
        minMatchScore: 0,
        dailyApplicationLimit: 1,
      }),
    });
    await createApplicationDecision({
      userId,
      jobId: sampleJobs[0].id,
      decision: "ignore",
      decisionReason: "I do not want to pursue this employer.",
      matchScore: 80,
      riskLevel: "low",
      reviewRequired: 0,
      decidedBy: "user",
    });

    await runAutonomousForUser(userId, { dailyApplicationLimit: 1, minMatchScore: 0 });
    const decisions = await getUserApplicationDecisions(userId);

    expect(decisions).toEqual([expect.objectContaining({
      jobId: sampleJobs[0].id,
      decision: "ignore",
      decidedBy: "user",
      decisionReason: "I do not want to pursue this employer.",
    })]);
  });

  it("does not prepare or overwrite a high-fit job after an explicit user decision", async () => {
    const userId = await createEligibleTestUser("99114");
    await upsertUserProfile({
      userId,
      skills: "React, TypeScript, Node.js",
      experience: "Five years building production web applications.",
      desiredJobTypes: "full-time",
      desiredLocations: "remote, worldwide",
      resumeUrl: "https://example.com/resume.pdf",
      preferences: JSON.stringify({
        autonomousEnabled: true,
        mode: "review_first",
        minMatchScore: 0,
        dailyApplicationLimit: 1,
      }),
    });
    await createApplicationDecision({
      userId,
      jobId: sampleJobs[0].id,
      decision: "ignore",
      decisionReason: "User decided not to pursue this employer.",
      matchScore: 95,
      riskLevel: "low",
      reviewRequired: 0,
      decidedBy: "user",
    });

    const result = await runAutonomousForUser(userId, { dailyApplicationLimit: 1, minMatchScore: 0 });
    const decisions = await getUserApplicationDecisions(userId);

    expect(result.userDecisionLockedJobs).toBe(1);
    expect(result.queuedReviewRecords + result.queuedApplicationRecords + result.queuedManualRecords).toBe(0);
    expect(await getUserApplications(userId)).toHaveLength(0);
    expect(await listUserApplicationApprovals(userId, "all")).toHaveLength(0);
    expect(decisions).toEqual([expect.objectContaining({
      jobId: sampleJobs[0].id,
      decision: "ignore",
      decidedBy: "user",
      decisionReason: "User decided not to pursue this employer.",
    })]);
  });

  it("records daily-limit deferrals as saved decisions for a future run", async () => {
    const userId = await createEligibleTestUser("99113");
    mocks.getActiveJobs.mockResolvedValue([sampleJobs[0], sampleJobs[1]]);
    await upsertUserProfile({
      userId,
      skills: "React, TypeScript, Node.js",
      experience: "Five years building production web applications.",
      desiredJobTypes: "full-time",
      desiredLocations: "remote, worldwide",
      preferences: JSON.stringify({
        autonomousEnabled: true,
        mode: "review_first",
        minMatchScore: 0,
        dailyApplicationLimit: 1,
      }),
    });

    const result = await runAutonomousForUser(userId, { dailyApplicationLimit: 1, minMatchScore: 0 });
    const decisions = await getUserApplicationDecisions(userId);
    const deferredDecision = decisions.find((decision) => decision.decision === "save");

    expect(result.summary.skipped).toBe(1);
    expect(deferredDecision).toEqual(expect.objectContaining({
      reviewRequired: 0,
      decisionReason: expect.stringContaining("Daily preparation limit reached"),
    }));
  });

  it("does not draft routine follow-ups while an employer response needs review", async () => {
    const userId = await createEligibleTestUser("99102");
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

  it("does not draft routine follow-ups after an interview is cancelled", async () => {
    const userId = await createEligibleTestUser("99106");
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
      status: "interview",
      appliedDate: staleDate,
      lastActivity: staleDate,
      notes: "Interview was later cancelled.",
    });
    const applicationId = Number(application.insertId);
    await recordInterviewInvite(applicationId, userId);
    const interview = await scheduleInterview({
      applicationId,
      interviewType: "video",
      scheduledAt: new Date(Date.now() + 3 * 86400000),
    }, userId);
    await updateInterviewStatus(interview.id, "cancelled", userId);
    await touchApplicationActivity(applicationId, userId, staleDate);

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
      event.afterState?.includes("Interview schedule was cancelled")
    )).toBe(true);
  });

  it("does not draft routine follow-ups while a completed interview needs an outcome", async () => {
    const userId = await createEligibleTestUser("99108");
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
      status: "interview",
      appliedDate: staleDate,
      lastActivity: staleDate,
      notes: "The interview completed but its result has not been recorded.",
    });
    const applicationId = Number(application.insertId);
    await recordInterviewInvite(applicationId, userId);
    const interview = await scheduleInterview({
      applicationId,
      interviewType: "video",
      scheduledAt: new Date(Date.now() + 3 * 86400000),
    }, userId);
    await updateInterviewStatus(interview.id, "completed", userId);
    await touchApplicationActivity(applicationId, userId, staleDate);

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
      event.afterState?.includes("completed interview needs an outcome")
    )).toBe(true);
  });

  it("does not draft routine follow-ups while a later interview round needs scheduling", async () => {
    const userId = await createEligibleTestUser("99107");
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
      status: "interview",
      appliedDate: staleDate,
      lastActivity: staleDate,
      notes: "The first interview round was completed and a second was invited.",
    });
    const applicationId = Number(application.insertId);
    await recordInterviewInvite(applicationId, userId);
    const firstRound = await scheduleInterview({
      applicationId,
      interviewType: "video",
      scheduledAt: new Date(Date.now() + 3 * 86400000),
    }, userId);
    await recordInterviewOutcome({
      interviewId: firstRound.id,
      outcome: "next_round",
      source: "email",
      summary: "Recruiter invited the candidate to a technical round after the first interview.",
    }, userId);
    await touchApplicationActivity(applicationId, userId, staleDate);

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
      event.afterState?.includes("newer interview invite needs scheduling")
    )).toBe(true);
  });

  it("does not create application preparation records when no active resume is available", async () => {
    const userId = await createEligibleTestUser("99103");
    mocks.getActiveResume.mockResolvedValue(null);
    await upsertUserProfile({
      userId,
      skills: "React, TypeScript, Node.js",
      experience: "Five years building production web applications.",
      desiredJobTypes: "full-time",
      desiredLocations: "remote, worldwide",
      resumeUrl: "https://untrusted.example.local/resume.pdf",
      resumeFileKey: "resumes/99103/legacy-resume.pdf",
      preferences: JSON.stringify({
        autonomousEnabled: true,
        mode: "review_first",
        minMatchScore: 0,
        dailyApplicationLimit: 1,
      }),
    });

    const result = await runAutonomousForUser(userId, { dailyApplicationLimit: 1, minMatchScore: 0 });
    const auditEvents = await getAuditEventsForUser(userId, 10);

    expect(result.skippedResumeEvidenceActions).toBeGreaterThan(0);
    expect(result.queuedReviewRecords + result.queuedApplicationRecords + result.queuedManualRecords).toBe(0);
    expect(await getUserApplications(userId)).toHaveLength(0);
    expect(auditEvents.some((event) =>
      event.action === "autonomous_application_preparation_blocked_missing_resume" &&
      event.afterState?.includes("skippedApplicationPreparations")
    )).toBe(true);
  });

  it("does not create materials or approvals when core profile evidence is incomplete", async () => {
    const userId = await createEligibleTestUser("99105");
    await upsertUserProfile({
      userId,
      skills: "React, TypeScript, Node.js",
      desiredLocations: "remote, worldwide",
      resumeUrl: "https://example.com/resume.pdf",
      preferences: JSON.stringify({
        autonomousEnabled: true,
        mode: "review_first",
        minMatchScore: 0,
        dailyApplicationLimit: 1,
      }),
    });

    const result = await runAutonomousForUser(userId, { dailyApplicationLimit: 1, minMatchScore: 0 });
    const auditEvents = await getAuditEventsForUser(userId, 10);

    expect(result.skippedProfileReadinessActions).toBeGreaterThan(0);
    expect(result.queuedReviewRecords + result.queuedApplicationRecords + result.queuedManualRecords).toBe(0);
    expect(await getUserApplications(userId)).toHaveLength(0);
    expect(await listUserApplicationApprovals(userId, "all")).toHaveLength(0);
    expect(auditEvents.some((event) =>
      event.action === "autonomous_application_preparation_blocked_profile_readiness" &&
      event.afterState?.includes("Experience missing") &&
      event.afterState?.includes("Target roles missing")
    )).toBe(true);
  });
});
