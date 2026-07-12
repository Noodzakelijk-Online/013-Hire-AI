import type { Application, ApplicationApproval, FollowUp, UserProfile } from "../drizzle/schema";
import {
  getActiveJobs,
  getApplicationCampaign,
  getEmployerResponses,
  getEducationEntries,
  getInterviewPreparationForJob,
  listUnreadInterviewNotifications,
  getUserApplicationDecisions,
  getUserApplications,
  getUserProfile,
  getUserOfferAttributionReviews,
  getUserSuccessFees,
  getUserSkills,
  getWorkExperiences,
  listUserConnectorAccounts,
  listAdminReviewItems,
  listUserApplicationApprovals,
  upsertApplicationCampaign,
} from "./db";
import { buildAutonomousPlan, parseAutonomousPreferences } from "./autonomousOrchestrator";
import { calculateProfileReadiness } from "./profileReadiness";
import { getActiveResume } from "./resumeStorage";
import {
  getProfileEvidenceControlSummary,
  type ProfileEvidenceProvider,
} from "@shared/profileEvidence";
import { buildAutonomousEvidenceGates } from "@shared/autonomousEvidenceGates";
import { getFollowUps, getInterviewSchedules, getUpcomingInterviews } from "./applicationFeatures";
import {
  getSuccessFeeComplianceQueue,
  getSuccessFeeComplianceSummary,
} from "./successFeeCompliance";

function unique(items: string[]): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function applicationStatusCount(
  applications: Array<{ status?: Application["status"] | null }>,
  statuses: string[]
): number {
  return applications.filter((application) => statuses.includes(application.status || "pending")).length;
}

function campaignTitle(profile?: Pick<UserProfile, "desiredJobTypes"> | null): string {
  const target = profile?.desiredJobTypes
    ?.split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)[0];
  return target ? `${target} campaign` : "Active job-search campaign";
}

type UserApplicationRecord = Awaited<ReturnType<typeof getUserApplications>>[number];

interface FollowUpSuppressionState {
  applicationsWithActiveDrafts: Set<number>;
  sourceResponsesWithActiveDrafts: Set<number>;
  approvedFollowUpsReadyToSend: Array<{
    followUpId: number;
    applicationId: number;
    jobId: number;
    approvalId: number;
    approvalTitle: string;
    riskLevel: string;
    purpose: string;
    sourceResponseId: number | null;
    responseType: string | null;
    messagePreview: string;
    approvedAt: Date | null;
    job: {
      id: number;
      title: string;
      company: string;
      location: string | null;
    } | null;
  }>;
}

function parseFollowUpApprovalPayload(approval: Pick<ApplicationApproval, "payload">): {
  purpose?: string;
  sourceResponseId?: number | null;
  responseType?: string | null;
  message?: string | null;
} {
  if (!approval.payload) return {};

  try {
    const parsed = JSON.parse(approval.payload);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return {
      purpose: typeof parsed.purpose === "string" ? parsed.purpose : undefined,
      sourceResponseId: typeof parsed.sourceResponseId === "number" ? parsed.sourceResponseId : null,
      responseType: typeof parsed.responseType === "string" ? parsed.responseType : null,
      message: typeof parsed.message === "string" ? parsed.message : null,
    };
  } catch {
    return {};
  }
}

function isActiveFollowUpSendApproval(approval: ApplicationApproval) {
  return (
    approval.entityType === "follow_up" &&
    approval.approvalType === "follow_up_send" &&
    ["pending", "approved"].includes(approval.status)
  );
}

async function getFollowUpSuppressionState(
  applications: UserApplicationRecord[],
  approvals: ApplicationApproval[],
  userId: number
): Promise<FollowUpSuppressionState> {
  const activeFollowUpApprovalById = new Map(
    approvals
      .filter(isActiveFollowUpSendApproval)
      .map((approval) => [approval.entityId, approval])
  );
  const state: FollowUpSuppressionState = {
    applicationsWithActiveDrafts: new Set(),
    sourceResponsesWithActiveDrafts: new Set(),
    approvedFollowUpsReadyToSend: [],
  };

  if (activeFollowUpApprovalById.size === 0) return state;

  const followUpsByApplication = await Promise.all(applications.map(async (application) => ({
    application,
    followUps: await getFollowUps(application.id, userId),
  })));

  for (const { application, followUps } of followUpsByApplication) {
    if (!["applied", "viewed", "interview"].includes(application.status || "pending")) {
      continue;
    }
    for (const followUp of followUps as FollowUp[]) {
      if (followUp.sentDate) continue;

      const approval = activeFollowUpApprovalById.get(followUp.id);
      if (!approval) continue;

      state.applicationsWithActiveDrafts.add(application.id);
      const payload = parseFollowUpApprovalPayload(approval);
      if (payload.purpose === "employer_reply" && typeof payload.sourceResponseId === "number") {
        state.sourceResponsesWithActiveDrafts.add(payload.sourceResponseId);
      }
      if (approval.status === "approved") {
        const message = followUp.message || payload.message || "";
        state.approvedFollowUpsReadyToSend.push({
          followUpId: followUp.id,
          applicationId: application.id,
          jobId: application.jobId,
          approvalId: approval.id,
          approvalTitle: approval.title,
          riskLevel: approval.riskLevel,
          purpose: payload.purpose || "routine_follow_up",
          sourceResponseId: payload.sourceResponseId ?? null,
          responseType: payload.responseType ?? null,
          messagePreview: message.length > 180 ? `${message.slice(0, 177)}...` : message,
          approvedAt: approval.decidedAt ?? null,
          job: application.job ? {
            id: application.job.id,
            title: application.job.title,
            company: application.job.company,
            location: application.job.location,
          } : null,
        });
      }
    }
  }

  state.approvedFollowUpsReadyToSend.sort((a, b) =>
    (b.approvedAt?.getTime() ?? 0) - (a.approvedAt?.getTime() ?? 0)
  );
  return state;
}

function hasScheduledInterview(
  schedules: Awaited<ReturnType<typeof getInterviewSchedules>>
): boolean {
  return schedules.some((schedule) =>
    ["scheduled", "rescheduled", "completed", "cancelled"].includes(schedule.status || "scheduled")
  );
}

async function getInterviewSchedulingQueue(applications: UserApplicationRecord[], userId: number) {
  const interviewApplications = applications.filter((application) => application.status === "interview");
  const schedulingState = await Promise.all(interviewApplications.map(async (application) => ({
    application,
    hasSchedule: hasScheduledInterview(await getInterviewSchedules(application.id, userId)),
  })));

  return schedulingState
    .filter((item) => !item.hasSchedule)
    .map(({ application }) => ({
      applicationId: application.id,
      jobId: application.jobId,
      status: application.status,
      lastActivity: application.lastActivity,
      job: application.job ? {
        id: application.job.id,
        title: application.job.title,
        company: application.job.company,
        location: application.job.location,
      } : null,
    }));
}

async function getInterviewNotificationQueue(applications: UserApplicationRecord[], userId: number) {
  const notifications = await listUnreadInterviewNotifications(userId, 5);
  const applicationsById = new Map(applications.map((application) => [application.id, application]));

  const items = await Promise.all(notifications.map(async (notification) => {
    const application = applicationsById.get(notification.applicationId);
    if (!application) return null;

    const response = (await getEmployerResponses(application.id, userId))
      .find((item) => item.id === notification.employerResponseId);
    if (!response || response.responseType !== "interview_invite") return null;

    return {
      notificationId: notification.id,
      applicationId: application.id,
      jobId: application.jobId,
      employerResponseId: response.id,
      notificationType: notification.notificationType,
      createdAt: notification.createdAt,
      receivedAt: response.receivedAt,
      summary: response.summary,
      job: application.job ? {
        id: application.job.id,
        title: application.job.title,
        company: application.job.company,
        location: application.job.location,
      } : null,
    };
  }));

  return items.filter((item): item is NonNullable<typeof item> => item !== null);
}

async function getEmployerResponseQueue(
  applications: UserApplicationRecord[],
  userId: number,
  suppressionState: FollowUpSuppressionState
) {
  const actionableStatuses = new Set(["applied", "viewed", "interview"]);
  const responseState = await Promise.all(applications.map(async (application) => {
    if (!actionableStatuses.has(application.status || "pending")) {
      return null;
    }

    const responses = await getEmployerResponses(application.id, userId);
    const latestResponse = responses[0];
    if (
      !latestResponse ||
      !["employer_question", "other"].includes(latestResponse.responseType) ||
      suppressionState.sourceResponsesWithActiveDrafts.has(latestResponse.id)
    ) {
      return null;
    }

    return {
      applicationId: application.id,
      jobId: application.jobId,
      responseId: latestResponse.id,
      responseType: latestResponse.responseType,
      source: latestResponse.source,
      summary: latestResponse.summary,
      receivedAt: latestResponse.receivedAt,
      status: application.status,
      job: application.job ? {
        id: application.job.id,
        title: application.job.title,
        company: application.job.company,
        location: application.job.location,
      } : null,
    };
  }));

  return responseState.filter((item): item is NonNullable<typeof item> => item !== null);
}

function getFollowUpDueQueue(
  applications: UserApplicationRecord[],
  plan: ReturnType<typeof buildAutonomousPlan>,
  excludedApplicationIds: Set<number> = new Set(),
  suppressionState: FollowUpSuppressionState = {
    applicationsWithActiveDrafts: new Set(),
    sourceResponsesWithActiveDrafts: new Set(),
    approvedFollowUpsReadyToSend: [],
  }
) {
  const applicationsById = new Map(applications.map((application) => [application.id, application]));
  return plan.followUps
    .filter((followUp) =>
      followUp.action === "send_follow_up" &&
      !excludedApplicationIds.has(followUp.applicationId) &&
      !suppressionState.applicationsWithActiveDrafts.has(followUp.applicationId)
    )
    .map((followUp) => {
      const application = applicationsById.get(followUp.applicationId);
      return {
        applicationId: followUp.applicationId,
        jobId: followUp.jobId,
        status: followUp.status,
        messageType: followUp.messageType,
        daysSinceActivity: followUp.daysSinceActivity,
        reason: followUp.reason,
        job: application?.job ? {
          id: application.job.id,
          title: application.job.title,
          company: application.job.company,
          location: application.job.location,
        } : null,
      };
    });
}

async function getInterviewPreparationQueue(userId: number) {
  const upcomingInterviews = await getUpcomingInterviews(userId);
  const items = await Promise.all(upcomingInterviews.map(async (item) => {
    const existingPreparation = await getInterviewPreparationForJob(userId, item.application.jobId);
    if (existingPreparation) return null;

    return {
      interviewId: item.interview.id,
      applicationId: item.application.id,
      jobId: item.application.jobId,
      scheduledAt: item.interview.scheduledAt,
      interviewType: item.interview.interviewType,
      status: item.interview.status,
      job: item.job ? {
        id: item.job.id,
        title: item.job.title,
        company: item.job.company,
      } : null,
    };
  }));

  return items.filter((item): item is NonNullable<typeof item> => item !== null);
}

function activeResponseApplicationCount(applications: UserApplicationRecord[]) {
  return applications.filter((application) =>
    ["applied", "viewed", "interview"].includes(application.status || "pending")
  ).length;
}

function providerIsConnected(provider?: ProfileEvidenceProvider) {
  return provider?.status === "connected";
}

function providerNeedsCompletion(provider: ProfileEvidenceProvider) {
  return provider.connectionStatus === "connection_requested" || provider.connectionStatus === "needs_reauth";
}

function connectorReadinessItem(input: {
  id: string;
  label: string;
  detail: string;
  providerIds: string[];
  status: string;
  riskLevel?: "low" | "medium" | "high";
  affectedApplications?: number;
}) {
  return {
    ...input,
    riskLevel: input.riskLevel ?? "medium",
    route: "/profile",
  };
}

export function getConnectorReadinessQueue(input: {
  profile: UserProfile | null | undefined;
  applications: UserApplicationRecord[];
  providers: ProfileEvidenceProvider[];
  hasActiveResumeArtifact: boolean;
}) {
  const providerById = new Map(input.providers.map((provider) => [provider.id, provider]));
  const items = input.providers
    .filter((provider) =>
      ["inbox", "cloud_storage"].includes(provider.category) &&
      providerNeedsCompletion(provider)
    )
    .map((provider) => connectorReadinessItem({
      id: provider.id,
      label: `${provider.label} setup`,
      detail: provider.detail,
      providerIds: [provider.id],
      status: provider.connectionStatus || provider.status,
      riskLevel: provider.category === "inbox" ? "medium" : "low",
    }));

  const hasConnectedInbox = ["gmail", "outlook"].some((providerId) => {
    const provider = providerById.get(providerId as ProfileEvidenceProvider["id"]);
    return providerIsConnected(provider);
  });
  const responseApplications = activeResponseApplicationCount(input.applications);
  if (responseApplications > 0 && !hasConnectedInbox) {
    items.push(connectorReadinessItem({
      id: "inbox-response-monitoring",
      label: "Inbox response monitoring",
      detail: `Connect Gmail or Outlook before Hire.AI can automatically detect replies for ${responseApplications} active application${responseApplications === 1 ? "" : "s"}.`,
      providerIds: ["gmail", "outlook"],
      status: "not_connected",
      riskLevel: "medium",
      affectedApplications: responseApplications,
    }));
  }

  const hasResumeEvidence = input.hasActiveResumeArtifact;
  const hasConnectedCloud = ["google_drive", "dropbox"].some((providerId) => {
    const provider = providerById.get(providerId as ProfileEvidenceProvider["id"]);
    return providerIsConnected(provider);
  });
  if (!hasResumeEvidence && !hasConnectedCloud) {
    items.push(connectorReadinessItem({
      id: "cloud-resume-discovery",
      label: "Cloud resume discovery",
      detail: "Connect Google Drive or Dropbox, or upload a resume, before Hire.AI can discover candidate documents.",
      providerIds: ["google_drive", "dropbox"],
      status: "not_connected",
      riskLevel: "medium",
    }));
  }

  return items.slice(0, 5);
}

export interface OperatingLedgerOptions {
  includeAdminReviews?: boolean;
}

export async function getUserOperatingLedger(userId: number, options: OperatingLedgerOptions = {}) {
  const [
    profile,
    workExperiences,
    educationEntries,
    skills,
    applications,
    jobs,
    allApprovals,
    adminReviews,
    decisions,
    successFees,
    offerAttributionReviews,
    connectorAccounts,
    activeResume,
  ] = await Promise.all([
    getUserProfile(userId),
    getWorkExperiences(userId),
    getEducationEntries(userId),
    getUserSkills(userId),
    getUserApplications(userId),
    getActiveJobs(250, 0),
    listUserApplicationApprovals(userId, "all"),
    listAdminReviewItems("all"),
    getUserApplicationDecisions(userId),
    getUserSuccessFees(userId),
    getUserOfferAttributionReviews(userId),
    listUserConnectorAccounts(userId),
    getActiveResume(userId),
  ]);
  const approvals = allApprovals.filter((approval) => approval.status === "pending");
  const existingCampaign = await getApplicationCampaign(userId);
  const campaignStatus = existingCampaign?.status ?? "active";

  const readiness = calculateProfileReadiness({
    profile: profile ?? undefined,
    workExperiences,
    educationEntries,
    skills,
    hasActiveResumeArtifact: Boolean(activeResume),
  });
  const profileEvidence = getProfileEvidenceControlSummary({
    profile,
    readiness,
    hasActiveResumeArtifact: Boolean(activeResume),
    connectorAccounts: connectorAccounts.map((account) => ({
      provider: account.provider,
      status: account.status,
      externalAccountLabel: account.externalAccountLabel,
      consentScopes: account.consentScopes,
    })),
  });
  const preferences = parseAutonomousPreferences(profile?.preferences);
  const plan = buildAutonomousPlan(
    jobs,
    profile,
    applications as Application[],
    preferences,
    Boolean(activeResume)
  );
  const userAdminReviews = options.includeAdminReviews
    ? adminReviews.filter((item) =>
        item.userId === userId && ["open", "in_progress"].includes(item.status)
      )
    : [];
  const reviewDecisions = decisions.filter((decision) =>
    decision.reviewRequired === 1 || ["review", "manual_apply"].includes(decision.decision)
  );
  const applicationsByJobId = new Map(applications.map((application) => [application.jobId, application]));
  const reviewDecisionQueue = reviewDecisions.map((decision) => {
    const application = applicationsByJobId.get(decision.jobId);

    return {
      ...decision,
      applicationId: application?.id ?? null,
      application: application
        ? {
            id: application.id,
            status: application.status,
            appliedDate: application.appliedDate,
            lastActivity: application.lastActivity,
          }
        : null,
    };
  });
  const submittedApplications = applications.filter((application) => application.status !== "pending");
  const responseCount = applicationStatusCount(applications, ["viewed", "interview", "offer", "accepted", "rejected"]);
  const followUpSuppressionState = await getFollowUpSuppressionState(applications, allApprovals, userId);
  const interviewSchedulingQueue = await getInterviewSchedulingQueue(applications, userId);
  const interviewNotificationQueue = await getInterviewNotificationQueue(applications, userId);
  const interviewPreparationQueue = await getInterviewPreparationQueue(userId);
  const employerResponseQueue = await getEmployerResponseQueue(applications, userId, followUpSuppressionState);
  const successFeeCompliance = getSuccessFeeComplianceSummary(successFees, offerAttributionReviews);
  const successFeeComplianceQueue = getSuccessFeeComplianceQueue(successFees, offerAttributionReviews);
  const followUpExcludedApplicationIds = new Set([
    ...interviewSchedulingQueue.map((item) => item.applicationId),
    ...employerResponseQueue.map((item) => item.applicationId),
  ]);
  const followUpDueQueue = preferences.createFollowUps
    ? getFollowUpDueQueue(applications, plan, followUpExcludedApplicationIds, followUpSuppressionState)
    : [];
  const approvedFollowUpsReadyToSend = followUpSuppressionState.approvedFollowUpsReadyToSend;
  const connectorReadinessQueue = getConnectorReadinessQueue({
    profile,
    applications,
    providers: profileEvidence.providers,
    hasActiveResumeArtifact: Boolean(activeResume),
  });
  const evidenceGates = buildAutonomousEvidenceGates({
    profileEvidence,
    connectorReadiness: connectorReadinessQueue,
  });

  const nextActions = unique([
    campaignStatus === "paused"
      ? "Resume the paused campaign before autonomous work can run."
      : "",
    ...readiness.nextActions,
    ...plan.nextActions,
    approvals.length > 0 ? `Resolve ${approvals.length} pending user approval${approvals.length === 1 ? "" : "s"}.` : "",
    userAdminReviews.length > 0
      ? `${userAdminReviews.length} item${userAdminReviews.length === 1 ? " needs" : "s need"} admin operating review.`
      : "",
    reviewDecisions.length > 0
      ? `Review ${reviewDecisions.length} saved application decision${reviewDecisions.length === 1 ? "" : "s"}.`
      : "",
    interviewSchedulingQueue.length > 0
      ? `Schedule ${interviewSchedulingQueue.length} interview invite${interviewSchedulingQueue.length === 1 ? "" : "s"} before follow-up automation continues.`
      : "",
    interviewNotificationQueue.length > 0
      ? `Review ${interviewNotificationQueue.length} verified interview invite${interviewNotificationQueue.length === 1 ? "" : "s"}.`
      : "",
    interviewPreparationQueue.length > 0
      ? `Prepare for ${interviewPreparationQueue.length} upcoming interview${interviewPreparationQueue.length === 1 ? "" : "s"}.`
      : "",
    employerResponseQueue.length > 0
      ? `Reply to ${employerResponseQueue.length} employer question${employerResponseQueue.length === 1 ? "" : "s"} before routine follow-ups continue.`
      : "",
    approvedFollowUpsReadyToSend.length > 0
      ? `Record send handoff for ${approvedFollowUpsReadyToSend.length} approved follow-up draft${approvedFollowUpsReadyToSend.length === 1 ? "" : "s"}.`
      : "",
    successFeeCompliance.status === "needs_attention" || successFeeCompliance.status === "due_soon"
      ? successFeeCompliance.nextAction
      : "",
    connectorReadinessQueue.length > 0
      ? `Complete ${connectorReadinessQueue.length} connector setup item${connectorReadinessQueue.length === 1 ? "" : "s"} before relying on external inbox or cloud evidence.`
      : "",
    evidenceGates.length > 0
      ? `Resolve ${evidenceGates.length} autonomous evidence gate${evidenceGates.length === 1 ? "" : "s"} before external application or follow-up execution.`
      : "",
  ]).slice(0, 8);
  const blockers = unique([
    campaignStatus === "paused" ? "Campaign is paused" : "",
    ...readiness.blockers.map((gap) => gap.label),
    ...plan.policyWarnings,
    ...evidenceGates
      .filter((gate) => gate.severity === "high")
      .map((gate) => gate.label),
    approvals.length > 0 ? "Pending user approvals" : "",
    userAdminReviews.length > 0 ? "Open admin review items" : "",
    successFeeCompliance.status === "needs_attention" ? "Success-fee compliance needs attention" : "",
  ]);

  const campaignWrite = await upsertApplicationCampaign({
    userId,
    status: campaignStatus,
    title: campaignTitle(profile),
    targetRoles: profile?.desiredJobTypes ?? null,
    targetLocations: profile?.desiredLocations ?? null,
    salaryMin: profile?.salaryExpectationMin ?? null,
    salaryMax: profile?.salaryExpectationMax ?? null,
    remoteOnly: preferences.remoteOnly === false ? 0 : 1,
    automationMode: plan.mode,
    dailyApplicationLimit: preferences.dailyApplicationLimit ?? 12,
    minMatchScore: preferences.minMatchScore ?? 70,
    readinessScore: readiness.score,
    autoApplyEligible: readiness.autoApplyEligible ? 1 : 0,
    blockers: JSON.stringify(blockers),
    nextActions: JSON.stringify(nextActions),
    lastPlanSummary: JSON.stringify(plan.summary),
    lastSyncedAt: new Date(),
  }, { preserveStatus: true });
  const campaign = await getApplicationCampaign(userId);

  return {
    campaign: campaign ?? {
      id: Number(campaignWrite.insertId),
      userId,
      status: "active",
      title: campaignTitle(profile),
      targetRoles: profile?.desiredJobTypes ?? null,
      targetLocations: profile?.desiredLocations ?? null,
      salaryMin: profile?.salaryExpectationMin ?? null,
      salaryMax: profile?.salaryExpectationMax ?? null,
      remoteOnly: preferences.remoteOnly === false ? 0 : 1,
      automationMode: plan.mode,
      dailyApplicationLimit: preferences.dailyApplicationLimit ?? 12,
      minMatchScore: preferences.minMatchScore ?? 70,
      readinessScore: readiness.score,
      autoApplyEligible: readiness.autoApplyEligible ? 1 : 0,
      blockers: JSON.stringify(blockers),
      nextActions: JSON.stringify(nextActions),
      lastPlanSummary: JSON.stringify(plan.summary),
      lastSyncedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    readiness,
    planSummary: plan.summary,
    metrics: {
      trackedApplications: applications.length,
      preparedApplications: applicationStatusCount(applications, ["pending"]),
      submittedApplications: submittedApplications.length,
      employerResponses: responseCount,
      employerResponsesNeedingReply: employerResponseQueue.length,
      interviews: applicationStatusCount(applications, ["interview"]),
      unreadInterviewNotifications: interviewNotificationQueue.length,
      interviewSchedulingNeeded: interviewSchedulingQueue.length,
      interviewPreparationNeeded: interviewPreparationQueue.length,
      offers: applicationStatusCount(applications, ["offer", "accepted"]),
      activeSuccessFees: successFeeCompliance.activeFees,
      pendingOfferAttributions: successFeeCompliance.pendingOfferAttributions,
      pendingSuccessFeeVerifications: successFeeCompliance.pendingVerification,
      overdueSuccessFeeVerifications: successFeeCompliance.overdueVerifications,
      dueSoonSuccessFeeVerifications: successFeeCompliance.dueSoonVerifications,
      successFeeMonthlyCents: successFeeCompliance.monthlyFeeCents,
      pendingApprovals: approvals.length,
      approvedFollowUpsReadyToSend: approvedFollowUpsReadyToSend.length,
      evidenceGates: evidenceGates.length,
      connectorReadiness: connectorReadinessQueue.length,
      openAdminReviews: userAdminReviews.length,
      reviewRequiredDecisions: reviewDecisions.length,
      followUpsDue: followUpDueQueue.length,
      policyWarnings: plan.summary.policyWarnings,
      dailyRemaining: plan.summary.dailyRemaining,
    },
    queues: {
      pendingApprovals: approvals.slice(0, 5),
      adminReviews: userAdminReviews.slice(0, 5),
      reviewDecisions: reviewDecisionQueue.slice(0, 5),
      interviewNotifications: interviewNotificationQueue,
      interviewScheduling: interviewSchedulingQueue.slice(0, 5),
      interviewPreparationNeeded: interviewPreparationQueue.slice(0, 5),
      employerResponsesNeedingReply: employerResponseQueue.slice(0, 5),
      followUpsDue: followUpDueQueue.slice(0, 5),
      approvedFollowUpsReadyToSend: approvedFollowUpsReadyToSend.slice(0, 5),
      evidenceGates,
      successFeeCompliance: successFeeComplianceQueue.slice(0, 5),
      connectorReadiness: connectorReadinessQueue,
    },
    successFeeCompliance,
    profileEvidence,
    canReviewAdminItems: options.includeAdminReviews === true,
    nextActions,
    blockers,
  };
}
