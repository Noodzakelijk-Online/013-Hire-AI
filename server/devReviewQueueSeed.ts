import type { User } from "../drizzle/schema";
import {
  createFollowUp,
  getFollowUps,
} from "./applicationFeatures";
import {
  createAdminReviewItem,
  createApplication,
  createApplicationApproval,
  createApplicationAttempt,
  createApplicationMaterial,
  createAuditEvent,
  createApplicationDecision,
  createEmployerResponse,
  createSuccessFee,
  getUserByOpenId,
  getUserSuccessFees,
  listUserApplicationApprovals,
  resolveApplicationApproval,
  upsertUser,
  upsertUserProfile,
} from "./db";

export const DEV_REVIEW_QUEUE_OPEN_ID = "dev-review-queue-user";
export const DEV_REVIEW_QUEUE_EMAIL = "review-queue.dev@example.local";
export const DEV_ADMIN_OPEN_ID = "dev-admin-user";
export const DEV_ADMIN_EMAIL = "admin.dev@example.local";

export async function seedDevAdminUser(): Promise<User> {
  await seedDevReviewQueueUser();
  await upsertUser({
    openId: DEV_ADMIN_OPEN_ID,
    name: "Admin QA",
    email: DEV_ADMIN_EMAIL,
    loginMethod: "dev",
    role: "admin",
    accountStatus: "active",
    tosAcceptedAt: new Date(),
    lastSignedIn: new Date(),
  });

  const user = await getUserByOpenId(DEV_ADMIN_OPEN_ID);
  if (!user) {
    throw new Error("Unable to create development admin user.");
  }

  return user;
}

export async function seedDevReviewQueueUser(): Promise<User> {
  await upsertUser({
    openId: DEV_REVIEW_QUEUE_OPEN_ID,
    name: "Review Queue QA",
    email: DEV_REVIEW_QUEUE_EMAIL,
    loginMethod: "dev",
    role: "user",
    accountStatus: "active",
    tosAcceptedAt: new Date(),
    lastSignedIn: new Date(),
  });

  const user = await getUserByOpenId(DEV_REVIEW_QUEUE_OPEN_ID);
  if (!user) {
    throw new Error("Unable to create development review queue user.");
  }

  await upsertUserProfile({
    userId: user.id,
    skills: "React, TypeScript, Node.js, PostgreSQL, API design",
    experience: "Five years building production web applications and automation tools.",
    desiredJobTypes: "Full Stack Engineer, Frontend Engineer",
    desiredLocations: "Remote",
    resumeUrl: "",
    resumeFileKey: "",
    preferences: JSON.stringify({
      mode: "review_first",
      dailyApplicationLimit: 4,
      minMatchScore: 70,
      requireHumanReview: true,
      createFollowUps: true,
      remoteOnly: true,
    }),
  });

  const applicationResult = await createApplication({
    userId: user.id,
    jobId: 1,
    status: "pending",
    notes: "Prepared for QA review; external submission is not confirmed.",
    coverLetter: "Draft cover letter prepared from profile evidence.",
    isAutoApplied: 0,
  });
  const applicationId = Number(applicationResult.insertId);

  await createApplicationMaterial({
    applicationId,
    coverLetter: "Draft cover letter prepared from profile evidence.",
    customAnswers: JSON.stringify({
      source: "devReviewQueueSeed",
      action: "review_required",
      atsType: "greenhouse",
      automationSupported: false,
      automationNotes: [
        "Greenhouse application can be prepared for review.",
        "External submission requires explicit user approval.",
      ],
    }),
    claimsMade: JSON.stringify({
      supportedClaimsOnly: true,
      reasons: [
        "React, TypeScript, Node.js, PostgreSQL, and API design appear in the profile.",
        "Remote web application experience supports the role requirements.",
      ],
      blockers: [
        "Resume evidence is not linked to the QA profile.",
        "Screening answers must be reviewed before external submission.",
      ],
      note: "No unsupported qualifications, certifications, work authorization, or salary claims were made.",
    }),
    sourceProfileSnapshot: JSON.stringify({
      source: "devReviewQueueSeed",
      profile: {
        skills: "React, TypeScript, Node.js, PostgreSQL, API design",
        experience: "Five years building production web applications and automation tools.",
        desiredJobTypes: "Full Stack Engineer, Frontend Engineer",
        desiredLocations: "Remote",
        resumeUrl: null,
        resumeFileKey: null,
      },
    }),
  });

  const respondedApplicationResult = await createApplication({
    userId: user.id,
    jobId: 2,
    status: "offer",
    appliedDate: new Date("2026-06-20T09:00:00.000Z"),
    lastActivity: new Date("2026-07-01T12:00:00.000Z"),
    notes: "Submitted application with interview and written-offer evidence for QA.",
    coverLetter: "Submitted cover letter prepared from profile evidence.",
    isAutoApplied: 0,
  });
  const respondedApplicationId = Number(respondedApplicationResult.insertId);

  await createApplicationAttempt({
    applicationId: respondedApplicationId,
    userId: user.id,
    jobId: 2,
    attemptType: "manual_confirmation",
    status: "submitted",
    startedAt: new Date("2026-06-20T09:00:00.000Z"),
    finishedAt: new Date("2026-06-20T09:05:00.000Z"),
    confirmationText: "Employer portal confirmed the QA application was submitted.",
    confirmationUrl: "https://example.com/application-confirmation",
    retryCount: 0,
  });

  await createEmployerResponse({
    applicationId: respondedApplicationId,
    userId: user.id,
    responseType: "interview_invite",
    source: "email",
    summary: "Recruiter emailed asking for interview availability next week.",
    receivedAt: new Date("2026-06-28T15:00:00.000Z"),
    statusBefore: "applied",
    statusAfter: "interview",
  });

  const offerResponse = await createEmployerResponse({
    applicationId: respondedApplicationId,
    userId: user.id,
    responseType: "offer",
    source: "email",
    summary: "Recruiter sent a written remote offer with salary and start-date details.",
    receivedAt: new Date("2026-07-01T12:00:00.000Z"),
    statusBefore: "interview",
    statusAfter: "offer",
  });
  const offerResponseId = Number(offerResponse.insertId);

  const followUpApplicationResult = await createApplication({
    userId: user.id,
    jobId: 4,
    status: "applied",
    appliedDate: new Date("2026-06-17T10:00:00.000Z"),
    lastActivity: new Date("2026-06-17T10:00:00.000Z"),
    notes: "Submitted QA application with no recent employer response; routine follow-up is due.",
    coverLetter: "Submitted cover letter prepared from profile evidence.",
    isAutoApplied: 0,
  });
  const followUpApplicationId = Number(followUpApplicationResult.insertId);

  const questionApplicationResult = await createApplication({
    userId: user.id,
    jobId: 3,
    status: "viewed",
    appliedDate: new Date("2026-06-18T11:00:00.000Z"),
    lastActivity: new Date("2026-06-27T14:00:00.000Z"),
    notes: "Employer asked for clarification; QA queue should surface reply work.",
    coverLetter: "Submitted cover letter prepared from profile evidence.",
    isAutoApplied: 0,
  });
  const questionApplicationId = Number(questionApplicationResult.insertId);

  await createEmployerResponse({
    applicationId: questionApplicationId,
    userId: user.id,
    responseType: "employer_question",
    source: "email",
    summary: "Recruiter asked for availability and clarification about distributed team collaboration.",
    receivedAt: new Date("2026-06-27T14:00:00.000Z"),
    statusBefore: "applied",
    statusAfter: "viewed",
  });

  await createApplicationAttempt({
    applicationId: followUpApplicationId,
    userId: user.id,
    jobId: 4,
    attemptType: "manual_confirmation",
    status: "submitted",
    startedAt: new Date("2026-06-17T10:00:00.000Z"),
    finishedAt: new Date("2026-06-17T10:04:00.000Z"),
    confirmationText: "Employer portal confirmed the QA application was submitted.",
    confirmationUrl: "https://example.com/follow-up-confirmation",
    retryCount: 0,
  });

  const existingFollowUps = await getFollowUps(followUpApplicationId, user.id);
  const existingFollowUpApprovals = await listUserApplicationApprovals(user.id, "all");
  const hasApprovedUnsentFollowUp = existingFollowUps.some((followUp) =>
    !followUp.sentDate &&
    existingFollowUpApprovals.some((approval) =>
      approval.entityType === "follow_up" &&
      approval.entityId === followUp.id &&
      approval.approvalType === "follow_up_send" &&
      approval.status === "approved"
    )
  );
  if (!hasApprovedUnsentFollowUp) {
    const approvedFollowUp = await createFollowUp({
      applicationId: followUpApplicationId,
      message: "Hi, I am checking in on my submitted application and remain interested in the role.",
    }, user.id);
    const followUpApproval = (await listUserApplicationApprovals(user.id, "pending")).find((approval) =>
      approval.entityType === "follow_up" &&
      approval.entityId === approvedFollowUp.id &&
      approval.approvalType === "follow_up_send"
    );
    if (followUpApproval) {
      await resolveApplicationApproval(
        followUpApproval.id,
        user.id,
        "approved",
        "Approved QA follow-up draft so the review queue can verify send handoffs.",
        "user"
      );
    }
  }

  await createApplicationApproval({
    userId: user.id,
    applicationId,
    entityType: "application",
    entityId: applicationId,
    approvalType: "application_submission",
    status: "pending",
    riskLevel: "high",
    requestedBy: "system",
    title: "Approve prepared external submission",
    description: "The QA application is ready, but Hire.AI must not submit it externally without explicit user approval.",
    payload: JSON.stringify({
      jobId: 1,
      reason: "external_application_submission",
      qaSeed: true,
    }),
  });

  await createApplicationApproval({
    userId: user.id,
    applicationId: respondedApplicationId,
    entityType: "application",
    entityId: respondedApplicationId,
    approvalType: "offer_attribution",
    status: "pending",
    riskLevel: "high",
    requestedBy: "system",
    title: "Confirm offer attribution",
    description: "Recruiter sent a written remote offer with salary and start-date details.",
    payload: JSON.stringify({
      applicationId: respondedApplicationId,
      responseId: offerResponseId,
      responseType: "offer",
      qaSeed: true,
    }),
  });

  await createApplicationDecision({
    userId: user.id,
    jobId: 1,
    decision: "review",
    decisionReason: "High match, but resume evidence and screening answers must be checked before external submission.",
    matchScore: 91,
    riskLevel: "high",
    reviewRequired: 1,
    reviewReason: "External application submission is blocked until supported claims, resume evidence, and user approval are verified.",
    decidedBy: "system",
  });

  await createApplicationDecision({
    userId: user.id,
    jobId: 2,
    decision: "review",
    decisionReason: "Strong fit, but screening answers require human confirmation.",
    matchScore: 86,
    riskLevel: "medium",
    reviewRequired: 1,
    reviewReason: "Needs custom answer about remote collaboration and salary expectations.",
    decidedBy: "system",
  });

  const existingSuccessFees = await getUserSuccessFees(user.id);
  const hasQaSuccessFee = existingSuccessFees.some((fee) =>
    fee.employerName === "QA Success Employer" &&
    ["active", "pending_verification"].includes(fee.status)
  );
  if (!hasQaSuccessFee) {
    await createSuccessFee({
      userId: user.id,
      applicationId: null,
      employerName: "QA Success Employer",
      jobTitle: "Remote Ledger Engineer",
      monthlySalary: 8000,
      currency: "USD",
      feePercent: 5,
      monthlyFeeAmount: 40000,
      status: "active",
      startDate: new Date("2026-06-01T00:00:00.000Z"),
      nextVerificationDue: new Date("2026-08-30T00:00:00.000Z"),
      stripeSubscriptionId: "sub_dev_success_fee",
      stripePriceId: "price_dev_success_fee",
      offerLetterUrl: "https://example.com/dev-offer-letter.pdf",
      offerLetterKey: "dev/offer-letter.pdf",
      termsAcceptedAt: new Date("2026-06-01T00:00:00.000Z"),
      notes: "Seeded active success-fee record for billing control QA. Do not use for real billing.",
    });
  }

  await createAdminReviewItem({
    userId: user.id,
    entityType: "application",
    entityId: applicationId,
    category: "application_review",
    priority: "high",
    title: "QA account has pending high-risk application action",
    description: "Admin can verify that user approval gates and application evidence remain connected.",
  });

  await createAuditEvent({
    userId: user.id,
    entityType: "application",
    entityId: applicationId,
    action: "application_prepared_for_review",
    actor: "system",
    source: "devReviewQueueSeed",
    riskLevel: "medium",
    afterState: JSON.stringify({
      applicationId,
      jobId: 1,
      status: "pending",
      qaSeed: true,
    }),
  });

  await createAuditEvent({
    userId: user.id,
    entityType: "application",
    entityId: applicationId,
    action: "approval_requested",
    actor: "system",
    source: "devReviewQueueSeed",
    riskLevel: "high",
    afterState: JSON.stringify({
      approvalType: "application_submission",
      qaSeed: true,
    }),
  });

  await createAuditEvent({
    userId: user.id,
    entityType: "application",
    entityId: respondedApplicationId,
    action: "employer_response_recorded",
    actor: "system",
    source: "devReviewQueueSeed",
    riskLevel: "medium",
    afterState: JSON.stringify({
      applicationId: respondedApplicationId,
      responseType: "interview_invite",
      status: "interview",
      qaSeed: true,
    }),
  });

  await createAuditEvent({
    userId: user.id,
    entityType: "application",
    entityId: respondedApplicationId,
    action: "stale_follow_up_approvals_cancelled",
    actor: "system",
    source: "devReviewQueueSeed",
    riskLevel: "medium",
    afterState: JSON.stringify({
      applicationId: respondedApplicationId,
      responseType: "interview_invite",
      cancelledApprovalIds: [9001],
      qaSeed: true,
    }),
  });

  await createAuditEvent({
    userId: user.id,
    entityType: "application",
    entityId: followUpApplicationId,
    action: "application_follow_up_due_seeded",
    actor: "system",
    source: "devReviewQueueSeed",
    riskLevel: "low",
    afterState: JSON.stringify({
      applicationId: followUpApplicationId,
      jobId: 4,
      status: "applied",
      qaSeed: true,
    }),
  });

  await createAuditEvent({
    userId: user.id,
    entityType: "application",
    entityId: questionApplicationId,
    action: "employer_question_reply_due_seeded",
    actor: "system",
    source: "devReviewQueueSeed",
    riskLevel: "low",
    afterState: JSON.stringify({
      applicationId: questionApplicationId,
      jobId: 3,
      status: "viewed",
      qaSeed: true,
    }),
  });

  return user;
}
