import type { AutonomousJobDecision, AutonomousPlan, AutonomousPreferences } from "./autonomousOrchestrator";
import { randomUUID } from "node:crypto";
import {
  buildAutonomousPlan,
  getExecutableDecisions,
  parseAutonomousPreferences,
} from "./autonomousOrchestrator";
import {
  createApplication,
  createApplicationApproval,
  createApplicationAttempt,
  createApplicationDecision,
  createApplicationMaterial,
  createAdminReviewItem,
  createAuditEvent,
  acquireAutonomousRunLease,
  completeAutonomousRunLease,
  getActiveJobs,
  getAutonomousUserEligibility,
  getApplicationLedgerArtifacts,
  getApplicationCampaign,
  getEmployerResponses,
  getUserApplications,
  getUserProfile,
  renewAutonomousRunLease,
} from "./db";
import {
  createFollowUp,
  generateFollowUpEmail,
  getFollowUps,
  getInterviewSchedules,
} from "./applicationFeatures";
import { getUserOperatingLedger } from "./applicationCampaigns";
import { AutonomousExecutionGuard } from "./autonomousExecutionGuard";
import { AutonomousRunRegistry } from "./autonomousRunRegistry";
import {
  countEvidenceGatedActions,
  type AutonomousEvidenceGate,
} from "../shared/autonomousEvidenceGates";
import { getAutonomousEvidenceContext } from "./autonomousEvidence";
import { getActiveResume } from "./resumeStorage";

export interface AutonomousRunResult extends AutonomousPlan {
  queuedApplicationRecords: number;
  queuedReviewRecords: number;
  queuedManualRecords: number;
  queuedFollowUps: number;
  skippedDuplicateFollowUps: number;
  skippedSafetyBlockedFollowUps: number;
  skippedResumeEvidenceActions: number;
  skippedProfileReadinessActions: number;
  skippedEvidenceGatedActions: number;
  evidenceGates: AutonomousEvidenceGate[];
  failedActions: number;
  actionErrors: string[];
}

const activeRuns = new AutonomousRunRegistry<AutonomousRunResult | null>();

function persistableRunSummary(result: AutonomousRunResult) {
  return {
    queuedApplicationRecords: result.queuedApplicationRecords,
    queuedReviewRecords: result.queuedReviewRecords,
    queuedManualRecords: result.queuedManualRecords,
    queuedFollowUps: result.queuedFollowUps,
    skippedDuplicateFollowUps: result.skippedDuplicateFollowUps,
    skippedSafetyBlockedFollowUps: result.skippedSafetyBlockedFollowUps,
    skippedResumeEvidenceActions: result.skippedResumeEvidenceActions,
    skippedProfileReadinessActions: result.skippedProfileReadinessActions,
    skippedEvidenceGatedActions: result.skippedEvidenceGatedActions,
    failedActions: result.failedActions,
  };
}

function wasNewApplication(result: unknown): boolean {
  return !(result && typeof result === "object" && "existing" in result && result.existing === true);
}

async function getCampaignExecutionBlock(userId: number): Promise<string | null> {
  const campaign = await getApplicationCampaign(userId);
  if (!campaign || campaign.status === "active") return null;
  return `The ${campaign.status} job-search campaign must be resumed before autonomous work can run.`;
}

function profileSnapshotForAutonomousRun(profile: unknown) {
  return JSON.stringify({
    source: "autonomousService",
    profile: profile ?? null,
  });
}

function riskForDecision(decision: AutonomousJobDecision, fallback: "medium" | "high" = "medium") {
  return decision.blockers.length > 0 ? "high" : fallback;
}

async function recordAutonomousApplicationLedgerArtifacts({
  userId,
  applicationId,
  decision,
  profile,
  resume,
  platformId,
  branch,
  approvalId,
}: {
  userId: number;
  applicationId: number;
  decision: AutonomousJobDecision;
  profile: unknown;
  resume: { id: number; version: number; fileName: string; fileKey: string };
  platformId?: number | null;
  branch: "auto_apply" | "review" | "manual";
  approvalId: number;
}) {
  const riskLevel = branch === "manual" ? "high" : riskForDecision(decision);
  const attemptType = branch === "manual" ? "external_handoff" : "prepare";
  const confirmationText = branch === "manual"
    ? "Autonomous run prepared a manual application handoff. No external submission was performed."
    : "Autonomous run prepared application materials for review. No external submission was performed.";
  const action = branch === "manual"
    ? "autonomous_manual_task_prepared"
    : branch === "review"
      ? "autonomous_review_queued"
      : "autonomous_application_prepared";

  const artifacts = await getApplicationLedgerArtifacts(applicationId, userId);
  if (!artifacts.material || artifacts.material.resumeId !== resume.id) {
    await createApplicationMaterial({
      applicationId,
      resumeId: resume.id,
      coverLetter: `Autonomous preparation note for ${decision.title} at ${decision.company}.`,
      customAnswers: JSON.stringify({
        source: "autonomousService",
        action: decision.action,
        atsType: decision.atsType,
        automationSupported: decision.automationSupported,
        automationNotes: decision.automationNotes,
      }),
      claimsMade: JSON.stringify({
        supportedClaimsOnly: true,
        reasons: decision.reasons,
        blockers: decision.blockers,
        note: "No qualifications, certifications, work authorization, salary history, or employment status were fabricated.",
      }),
      sourceProfileSnapshot: profileSnapshotForAutonomousRun(profile),
    });
  }

  const hasPreparationAttempt = artifacts.attempts.some((attempt) =>
    attempt.attemptType === attemptType && attempt.status === "review_required"
  );
  if (!hasPreparationAttempt) {
    await createApplicationAttempt({
      applicationId,
      userId,
      jobId: decision.jobId,
      platformId: platformId ?? undefined,
      attemptType,
      status: "review_required",
      finishedAt: new Date(),
      confirmationText,
      confirmationUrl: undefined,
      retryCount: 0,
    });
  }

  const hasPreparationAuditEvent = artifacts.auditEvents.some((event) =>
    event.action === action && event.approvalId === approvalId
  );
  if (!hasPreparationAuditEvent) {
    await createAuditEvent({
      userId,
      entityType: "application",
      entityId: applicationId,
      action,
      actor: "system",
      source: "autonomousService",
      afterState: JSON.stringify({
        jobId: decision.jobId,
        title: decision.title,
        company: decision.company,
        matchScore: decision.matchScore,
        atsType: decision.atsType,
        reviewRequired: true,
        approvalId,
        resume: {
          id: resume.id,
          version: resume.version,
          fileName: resume.fileName,
          fileKey: resume.fileKey,
        },
        externalSubmissionPerformed: false,
      }),
      riskLevel,
      approvalId,
    });
  }

  await createAdminReviewItem({
    userId,
    entityType: "application",
    entityId: applicationId,
    category: "application_review",
    priority: riskLevel,
    title: branch === "manual"
      ? "Manual application task prepared by autonomous run"
      : "Autonomous application prepared for review",
    description: [
      `${decision.title} at ${decision.company} was prepared by the autonomous runner.`,
      `Match score: ${decision.matchScore}.`,
      decision.blockers.length > 0 ? `Blockers: ${decision.blockers.join("; ")}.` : "",
      "No external submission was performed.",
    ].filter(Boolean).join(" "),
  });
}

async function getAutonomousFollowUpSafetyBlock(
  userId: number,
  followUp: { applicationId: number; status: string }
): Promise<string | null> {
  const responses = await getEmployerResponses(followUp.applicationId, userId);
  const latestResponse = responses[0];
  if (latestResponse && ["employer_question", "other"].includes(latestResponse.responseType)) {
    return "Employer response needs a reply before routine follow-up automation continues.";
  }

  if (followUp.status === "interview") {
    const schedules = await getInterviewSchedules(followUp.applicationId, userId);
    const hasSchedule = schedules.some((schedule) =>
      ["scheduled", "rescheduled", "completed", "cancelled"].includes(schedule.status || "scheduled")
    );
    if (!hasSchedule) {
      return "Interview invite needs scheduling before routine follow-up automation continues.";
    }
  }

  return null;
}

async function executeAutonomousRun(
  userId: number,
  overrides: AutonomousPreferences = {},
  assertLeaseActive: () => void = () => {}
): Promise<AutonomousRunResult> {
  const [jobList, profile, applications, activeResume] = await Promise.all([
    getActiveJobs(250, 0),
    getUserProfile(userId),
    getUserApplications(userId),
    getActiveResume(userId),
  ]);
  const resolvedPreferences = {
    ...parseAutonomousPreferences(profile?.preferences),
    ...overrides,
  };
  const plan = buildAutonomousPlan(jobList, profile, applications as any, resolvedPreferences);
  const executable = getExecutableDecisions(plan);
  const evidenceContext = await getAutonomousEvidenceContext(userId, {
    profile,
    applications,
  });
  const evidenceGates = evidenceContext.evidenceGates;
  const evidenceGatedActions = countEvidenceGatedActions({
    gates: evidenceGates,
    applicationSubmissionCandidates: executable.autoApply.length,
    followUpSendCandidates: resolvedPreferences.createFollowUps ? executable.followUps.length : 0,
  });
  const applicationPreparationCandidates =
    executable.autoApply.length + executable.review.length + executable.manual.length;
  const profileReadinessBlockers = evidenceContext.readiness.blockers.filter((gap) => gap.key !== "resume");
  const skippedProfileReadinessActions = profileReadinessBlockers.length > 0
    ? applicationPreparationCandidates
    : 0;
  const skippedResumeEvidenceActions = activeResume ? 0 : applicationPreparationCandidates;
  const executableApplicationDecisions = activeResume && skippedProfileReadinessActions === 0
    ? executable
    : { ...executable, autoApply: [], review: [], manual: [] };
  const jobById = new Map(jobList.map((job) => [job.id, job]));
  let queuedApplicationRecords = 0;
  let queuedReviewRecords = 0;
  let queuedManualRecords = 0;
  let completedActions = 0;
  const actionErrors: string[] = [];

  const recordFailure = (label: string, error: unknown) => {
    console.error(`[AutonomousService] ${label} failed for user ${userId}:`, error);
    actionErrors.push(`${label} failed`);
  };

  if (evidenceGates.length > 0) {
    await createAuditEvent({
      userId,
      entityType: "user",
      entityId: userId,
      action: "autonomous_evidence_gates_detected",
      actor: "system",
      source: "autonomousService",
      afterState: JSON.stringify({
        gates: evidenceGates,
        gatedActions: evidenceGatedActions,
        externalSubmissionPerformed: false,
      }),
      riskLevel: evidenceGates.some((gate) => gate.severity === "high") ? "high" : "medium",
    });
  }

  if (skippedResumeEvidenceActions > 0) {
    await createAuditEvent({
      userId,
      entityType: "user",
      entityId: userId,
      action: "autonomous_application_preparation_blocked_missing_resume",
      actor: "system",
      source: "autonomousService",
      afterState: JSON.stringify({
        skippedApplicationPreparations: skippedResumeEvidenceActions,
        autoApplyCandidates: executable.autoApply.length,
        reviewCandidates: executable.review.length,
        manualCandidates: executable.manual.length,
        externalSubmissionPerformed: false,
      }),
      riskLevel: "high",
    });
  }

  if (skippedProfileReadinessActions > 0) {
    await createAuditEvent({
      userId,
      entityType: "user",
      entityId: userId,
      action: "autonomous_application_preparation_blocked_profile_readiness",
      actor: "system",
      source: "autonomousService",
      afterState: JSON.stringify({
        skippedApplicationPreparations: skippedProfileReadinessActions,
        blockers: profileReadinessBlockers.map((gap) => ({
          key: gap.key,
          label: gap.label,
          recommendation: gap.recommendation,
        })),
        autoApplyCandidates: executable.autoApply.length,
        reviewCandidates: executable.review.length,
        manualCandidates: executable.manual.length,
        externalSubmissionPerformed: false,
      }),
      riskLevel: "high",
    });
  }

  for (const decision of executableApplicationDecisions.autoApply) {
    assertLeaseActive();
    try {
      const result = await createApplication({
        userId,
        jobId: decision.jobId,
        status: "pending",
        coverLetter: `Autonomous queue prepared for ${decision.title} at ${decision.company}.`,
        notes: [
          "Autonomous queue: application materials prepared for final user review.",
          `Match score: ${decision.matchScore}.`,
          `Priority: ${decision.priority}.`,
          `ATS: ${decision.atsType}.`,
        ].join(" "),
        isAutoApplied: 0,
      });
      await createApplicationDecision({
        userId,
        jobId: decision.jobId,
        decision: "apply",
        decisionReason: `Autonomous plan queued ${decision.title} at ${decision.company} for final user review.`,
        matchScore: decision.matchScore,
        riskLevel: decision.blockers.length > 0 ? "high" : "medium",
        reviewRequired: decision.reviewRequired ? 1 : 0,
        reviewReason: decision.blockers.join("; ") || null,
        decidedBy: "system",
      });
      const applicationId = Number(result.insertId);
      const approval = await createApplicationApproval({
        userId,
        applicationId,
        entityType: "application",
        entityId: applicationId,
        approvalType: "application_submission",
        status: "pending",
        riskLevel: decision.blockers.length > 0 ? "high" : "medium",
        requestedBy: "system",
        title: "Approve autonomous application submission",
        description: `Autonomous plan prepared ${decision.title} at ${decision.company} for final user review.`,
        payload: JSON.stringify({
          jobId: decision.jobId,
          matchScore: decision.matchScore,
          priority: decision.priority,
          atsType: decision.atsType,
          source: "autonomous.autoApply",
        }),
      });
      await recordAutonomousApplicationLedgerArtifacts({
        userId,
        applicationId,
        decision,
        profile,
        resume: activeResume!,
        platformId: jobById.get(decision.jobId)?.platformId,
        branch: "auto_apply",
        approvalId: Number(approval.insertId),
      });
      completedActions += 1;
      if (wasNewApplication(result)) queuedApplicationRecords += 1;
    } catch (error) {
      recordFailure(`Job ${decision.jobId} preparation`, error);
    }
  }

  for (const decision of executableApplicationDecisions.review) {
    assertLeaseActive();
    try {
      const result = await createApplication({
        userId,
        jobId: decision.jobId,
        status: "pending",
        coverLetter: `Review required before applying to ${decision.title} at ${decision.company}.`,
        notes: [
          "Autonomous review queue.",
          `Match score: ${decision.matchScore}.`,
          `Priority: ${decision.priority}.`,
          decision.blockers.length > 0 ? `Review blockers: ${decision.blockers.join("; ")}.` : "",
        ].filter(Boolean).join(" "),
        isAutoApplied: 0,
      });
      await createApplicationDecision({
        userId,
        jobId: decision.jobId,
        decision: "review",
        decisionReason: `Autonomous plan requires review before applying to ${decision.title} at ${decision.company}.`,
        matchScore: decision.matchScore,
        riskLevel: decision.blockers.length > 0 ? "high" : "medium",
        reviewRequired: 1,
        reviewReason: decision.blockers.join("; ") || "Human review required by policy.",
        decidedBy: "system",
      });
      const applicationId = Number(result.insertId);
      const approval = await createApplicationApproval({
        userId,
        applicationId,
        entityType: "application",
        entityId: applicationId,
        approvalType: "application_submission",
        status: "pending",
        riskLevel: decision.blockers.length > 0 ? "high" : "medium",
        requestedBy: "system",
        title: "Approve reviewed application submission",
        description: `Autonomous plan requires review before applying to ${decision.title} at ${decision.company}.`,
        payload: JSON.stringify({
          jobId: decision.jobId,
          matchScore: decision.matchScore,
          priority: decision.priority,
          blockers: decision.blockers,
          source: "autonomous.review",
        }),
      });
      await recordAutonomousApplicationLedgerArtifacts({
        userId,
        applicationId,
        decision,
        profile,
        resume: activeResume!,
        platformId: jobById.get(decision.jobId)?.platformId,
        branch: "review",
        approvalId: Number(approval.insertId),
      });
      completedActions += 1;
      if (wasNewApplication(result)) queuedReviewRecords += 1;
    } catch (error) {
      recordFailure(`Job ${decision.jobId} review queue`, error);
    }
  }

  for (const decision of executableApplicationDecisions.manual) {
    assertLeaseActive();
    try {
      const result = await createApplication({
        userId,
        jobId: decision.jobId,
        status: "pending",
        coverLetter: `Manual application task prepared for ${decision.title} at ${decision.company}.`,
        notes: `Autonomous manual apply queue. Unsupported ATS/platform: ${decision.atsType}. Match score: ${decision.matchScore}.`,
        isAutoApplied: 0,
      });
      await createApplicationDecision({
        userId,
        jobId: decision.jobId,
        decision: "manual_apply",
        decisionReason: `Autonomous plan prepared a manual application task for ${decision.title} at ${decision.company}.`,
        matchScore: decision.matchScore,
        riskLevel: "high",
        reviewRequired: 1,
        reviewReason: `Unsupported ATS/platform: ${decision.atsType}.`,
        decidedBy: "system",
      });
      const applicationId = Number(result.insertId);
      const approval = await createApplicationApproval({
        userId,
        applicationId,
        entityType: "application",
        entityId: applicationId,
        approvalType: "application_submission",
        status: "pending",
        riskLevel: "high",
        requestedBy: "system",
        title: "Approve manual application handoff",
        description: `Unsupported ATS/platform ${decision.atsType} requires manual application approval for ${decision.title} at ${decision.company}.`,
        payload: JSON.stringify({
          jobId: decision.jobId,
          matchScore: decision.matchScore,
          priority: decision.priority,
          atsType: decision.atsType,
          source: "autonomous.manual",
        }),
      });
      await recordAutonomousApplicationLedgerArtifacts({
        userId,
        applicationId,
        decision,
        profile,
        resume: activeResume!,
        platformId: jobById.get(decision.jobId)?.platformId,
        branch: "manual",
        approvalId: Number(approval.insertId),
      });
      completedActions += 1;
      if (wasNewApplication(result)) queuedManualRecords += 1;
    } catch (error) {
      recordFailure(`Job ${decision.jobId} manual queue`, error);
    }
  }

  let queuedFollowUps = 0;
  let skippedDuplicateFollowUps = 0;
  let skippedSafetyBlockedFollowUps = 0;
  if (resolvedPreferences.createFollowUps) {
    for (const followUp of executable.followUps) {
      assertLeaseActive();
      try {
        const safetyBlock = await getAutonomousFollowUpSafetyBlock(userId, followUp);
        if (safetyBlock) {
          skippedSafetyBlockedFollowUps += 1;
          await createAuditEvent({
            userId,
            entityType: "application",
            entityId: followUp.applicationId,
            action: "autonomous_follow_up_safety_blocked",
            actor: "system",
            source: "autonomousService",
            afterState: JSON.stringify({
              applicationId: followUp.applicationId,
              jobId: followUp.jobId,
              status: followUp.status,
              reason: safetyBlock,
              externalMessageSent: false,
            }),
            riskLevel: "medium",
          });
          continue;
        }

        const existingFollowUps = await getFollowUps(followUp.applicationId, userId);
        const cooldownStartedAt = Date.now() - 5 * 86400000;
        const hasBlockingFollowUp = existingFollowUps.some((existing) =>
          !existing.sentDate ||
          Boolean(existing.sentDate && new Date(existing.sentDate).getTime() >= cooldownStartedAt) ||
          existing.responseReceived === 1
        );
        if (hasBlockingFollowUp) {
          skippedDuplicateFollowUps += 1;
          continue;
        }

        assertLeaseActive();
        const email = await generateFollowUpEmail(followUp.applicationId, followUp.messageType, userId);
        assertLeaseActive();
        await createFollowUp({
          applicationId: followUp.applicationId,
          message: email,
        }, userId);
        completedActions += 1;
        queuedFollowUps += 1;
      } catch (error) {
        recordFailure(`Application ${followUp.applicationId} follow-up`, error);
      }
    }
  }

  if (actionErrors.length > 0 && completedActions === 0) {
    throw new Error(`Autonomous run failed all actions (${actionErrors.length} failures).`);
  }

  return {
    ...plan,
    queuedApplicationRecords,
    queuedReviewRecords,
    queuedManualRecords,
    queuedFollowUps,
    skippedDuplicateFollowUps,
    skippedSafetyBlockedFollowUps,
    skippedResumeEvidenceActions,
    skippedProfileReadinessActions,
    skippedEvidenceGatedActions: evidenceGatedActions.total,
    evidenceGates,
    failedActions: actionErrors.length,
    actionErrors,
  };
}

export function runAutonomousForUser(
  userId: number,
  overrides: AutonomousPreferences = {}
): Promise<AutonomousRunResult> {
  const activeRun = activeRuns.get(userId);
  if (activeRun) {
    if (Object.keys(overrides).length > 0) {
      return activeRun.then(
        () => runAutonomousForUser(userId, overrides),
        () => runAutonomousForUser(userId, overrides)
      );
    }
    return activeRun.then((result) =>
      result ?? runAutonomousForUser(userId, overrides)
    );
  }

  return activeRuns.track(
    userId,
    runWithLease(userId, overrides, 0, false)
  ).then((result) => {
    if (!result) {
      throw new Error("The autonomous run ended without a result.");
    }
    return result;
  });
}

export async function runScheduledAutonomousForUser(
  userId: number,
  minimumIntervalMs: number
): Promise<AutonomousRunResult | null> {
  if (activeRuns.has(userId)) return null;

  return await activeRuns.track(
    userId,
    runWithLease(userId, {}, minimumIntervalMs, true)
  );
}

async function runWithLease(
  userId: number,
  overrides: AutonomousPreferences,
  minimumIntervalMs: number,
  skipIfUnavailable: boolean
): Promise<AutonomousRunResult | null> {
  const eligibility = await getAutonomousUserEligibility(userId);
  if (!eligibility.eligible) {
    if (skipIfUnavailable) return null;
    throw new Error(eligibility.reason || "This account is not eligible for autonomous actions.");
  }

  const campaignBlock = await getCampaignExecutionBlock(userId);
  if (campaignBlock) {
    if (skipIfUnavailable) return null;
    throw new Error(campaignBlock);
  }

  if (skipIfUnavailable) {
    const profile = await getUserProfile(userId);
    const preferences = parseAutonomousPreferences(profile?.preferences);
    if (!preferences.autonomousEnabled) {
      return null;
    }
  }

  const leaseToken = randomUUID();
  const acquired = await acquireAutonomousRunLease(userId, leaseToken, minimumIntervalMs);
  if (!acquired) {
    if (skipIfUnavailable) return null;
    throw new Error("An autonomous run is already active for this account.");
  }

  const campaignBlockAfterLease = await getCampaignExecutionBlock(userId);
  if (campaignBlockAfterLease) {
    await completeAutonomousRunLease(userId, leaseToken, campaignBlockAfterLease);
    if (skipIfUnavailable) return null;
    throw new Error(campaignBlockAfterLease);
  }

  if (skipIfUnavailable) {
    try {
      const profile = await getUserProfile(userId);
      const preferences = parseAutonomousPreferences(profile?.preferences);
      if (!preferences.autonomousEnabled) {
        await completeAutonomousRunLease(
          userId,
          leaseToken,
          "Autonomous scheduling was disabled before execution started."
        );
        return null;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      try {
        await completeAutonomousRunLease(userId, leaseToken, message);
      } catch (completionError) {
        console.error(
          `[AutonomousService] Failed to release preflight lease for user ${userId}:`,
          completionError
        );
      }
      throw error;
    }
  }

  const executionGuard = new AutonomousExecutionGuard();
  const leaseRenewal = setInterval(() => {
    void renewAutonomousRunLease(userId, leaseToken)
      .then((renewed) => {
        if (!renewed) {
          executionGuard.markLeaseLost();
          console.error(`[AutonomousService] Lease ownership lost for user ${userId}.`);
        }
      })
      .catch((error) => {
        executionGuard.markLeaseLost(
          "The autonomous run stopped because its execution lease could not be verified."
        );
        console.error(`[AutonomousService] Failed to renew lease for user ${userId}:`, error);
      });
  }, 5 * 60 * 1000);
  leaseRenewal.unref();

  try {
    let result: AutonomousRunResult;
    try {
      result = await executeAutonomousRun(
        userId,
        overrides,
        () => executionGuard.assertLeaseActive()
      );
      executionGuard.assertLeaseActive();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      try {
        await completeAutonomousRunLease(userId, leaseToken, message);
      } catch (completionError) {
        console.error(`[AutonomousService] Failed to finalize failed run for user ${userId}:`, completionError);
      }
      throw error;
    }

    try {
      const completed = await completeAutonomousRunLease(
        userId,
        leaseToken,
        undefined,
        persistableRunSummary(result)
      );
      if (!completed) {
        throw new Error("The autonomous run lost its execution lease before completion.");
      }
      await getUserOperatingLedger(userId);
    } catch (error) {
      console.error(`[AutonomousService] Failed to finalize successful run for user ${userId}:`, error);
      throw new Error("Autonomous actions completed, but the run state could not be finalized.");
    }
    return result;
  } finally {
    clearInterval(leaseRenewal);
  }
}
