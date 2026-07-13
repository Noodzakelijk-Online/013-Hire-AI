export type ApplicationPipelineStatus =
  | "empty"
  | "approval_blocked"
  | "evidence_needed"
  | "offer_action"
  | "response_active"
  | "follow_up_candidate"
  | "clear";

export type ApplicationPipelineTab =
  | "all"
  | "active"
  | "approvals"
  | "evidence"
  | "interviewing"
  | "offered"
  | "closed";

export interface ApplicationPipelineApplicationLike {
  id?: number | null;
  status?: string | null;
}

export interface ApplicationPipelineApprovalLike {
  applicationId?: number | null;
  entityType?: string | null;
  entityId?: number | null;
  approvalType?: string | null;
  status?: string | null;
}

export interface ApplicationPipelineControlSummary {
  status: ApplicationPipelineStatus;
  label: string;
  headline: string;
  nextAction: string;
  primaryTab: ApplicationPipelineTab;
  primaryCta: string;
  trackedApplications: number;
  preparedApplications: number;
  approvalBlocked: number;
  evidenceNeeded: number;
  approvalBlockedApplicationIds: number[];
  evidenceNeededApplicationIds: number[];
  activeApplications: number;
  responseActive: number;
  interviewPipeline: number;
  offerActions: number;
  closedApplications: number;
  followUpCandidates: number;
}

const ACTIVE_STATUSES = new Set(["pending", "applied", "viewed", "interview"]);
const RESPONSE_STATUSES = new Set(["viewed", "interview", "offer", "accepted", "rejected"]);
const CLOSED_STATUSES = new Set(["rejected", "withdrawn", "accepted"]);
const FOLLOW_UP_CANDIDATE_STATUSES = new Set(["applied", "viewed", "interview"]);
const BLOCKING_APPROVAL_STATUSES = new Set(["pending", "rejected", "cancelled"]);

function applicationIdForApproval(approval: ApplicationPipelineApprovalLike) {
  if (approval.applicationId != null) return approval.applicationId;
  if (approval.entityType === "application" && approval.entityId != null) return approval.entityId;
  return null;
}

export function getApplicationPipelineControlSummary(
  applications: ApplicationPipelineApplicationLike[] = [],
  approvals: ApplicationPipelineApprovalLike[] = []
): ApplicationPipelineControlSummary {
  const applicationIds = new Set(
    applications
      .map((application) => application.id)
      .filter((id): id is number => typeof id === "number")
  );
  const pendingApplicationIds = new Set(
    applications
      .filter((application) => (application.status || "pending") === "pending")
      .map((application) => application.id)
      .filter((id): id is number => typeof id === "number")
  );
  const blockingSubmissionApprovals = approvals.filter((approval) =>
    approval.approvalType === "application_submission" &&
    BLOCKING_APPROVAL_STATUSES.has(approval.status || "") &&
    applicationIdForApproval(approval) != null &&
    applicationIds.has(applicationIdForApproval(approval) as number) &&
    pendingApplicationIds.has(applicationIdForApproval(approval) as number)
  );
  const approvalBlockedIds = new Set(
    blockingSubmissionApprovals
      .map(applicationIdForApproval)
      .filter((id): id is number => typeof id === "number")
  );

  const preparedApplications = applications.filter((application) => (application.status || "pending") === "pending");
  const evidenceNeededApplicationIds = preparedApplications
    .filter((application) => typeof application.id === "number" && !approvalBlockedIds.has(application.id))
    .map((application) => application.id as number);
  const evidenceNeeded = evidenceNeededApplicationIds.length;
  const activeApplications = applications.filter((application) =>
    ACTIVE_STATUSES.has(application.status || "pending")
  ).length;
  const responseActive = applications.filter((application) =>
    RESPONSE_STATUSES.has(application.status || "") &&
    !CLOSED_STATUSES.has(application.status || "")
  ).length;
  const interviewPipeline = applications.filter((application) =>
    ["interview", "offer", "accepted"].includes(application.status || "")
  ).length;
  const offerActions = applications.filter((application) => application.status === "offer").length;
  const closedApplications = applications.filter((application) =>
    CLOSED_STATUSES.has(application.status || "")
  ).length;
  const followUpCandidates = applications.filter((application) =>
    FOLLOW_UP_CANDIDATE_STATUSES.has(application.status || "")
  ).length;

  const base = {
    trackedApplications: applications.length,
    preparedApplications: preparedApplications.length,
    approvalBlocked: approvalBlockedIds.size,
    evidenceNeeded,
    approvalBlockedApplicationIds: Array.from(approvalBlockedIds),
    evidenceNeededApplicationIds,
    activeApplications,
    responseActive,
    interviewPipeline,
    offerActions,
    closedApplications,
    followUpCandidates,
  };

  if (applications.length === 0) {
    return {
      ...base,
      status: "empty",
      label: "No ledger yet",
      headline: "No applications are being tracked.",
      nextAction: "Complete your profile and run discovery so Hire.AI can prepare controlled application work.",
      primaryTab: "all",
      primaryCta: "All applications",
    };
  }

  if (approvalBlockedIds.size > 0) {
    return {
      ...base,
      status: "approval_blocked",
      label: "Approval blocked",
      headline: `${approvalBlockedIds.size} prepared submission${approvalBlockedIds.size === 1 ? "" : "s"} need a decision before any external action.`,
      nextAction: "Open the prepared applications and approve or reject submission gates before recording evidence.",
      primaryTab: "approvals",
      primaryCta: "Review approvals",
    };
  }

  if (evidenceNeeded > 0) {
    return {
      ...base,
      status: "evidence_needed",
      label: "Evidence needed",
      headline: `${evidenceNeeded} prepared application${evidenceNeeded === 1 ? "" : "s"} still need submission proof.`,
      nextAction: "Confirm submission only after employer portal, ATS, email, or manual evidence is available.",
      primaryTab: "evidence",
      primaryCta: "Review prepared",
    };
  }

  if (offerActions > 0) {
    return {
      ...base,
      status: "offer_action",
      label: "Offer action",
      headline: `${offerActions} offer${offerActions === 1 ? "" : "s"} need attribution and hire reporting review.`,
      nextAction: "Review the offer source before reporting a hire or starting success-fee billing.",
      primaryTab: "offered",
      primaryCta: "Review offers",
    };
  }

  if (responseActive > 0) {
    return {
      ...base,
      status: "response_active",
      label: "Responses active",
      headline: `${responseActive} application${responseActive === 1 ? " has" : "s have"} employer response history.`,
      nextAction: "Keep responses, interviews, rejections, and offers classified so the ledger stays current.",
      primaryTab: interviewPipeline > 0 ? "interviewing" : "active",
      primaryCta: interviewPipeline > 0 ? "Open interviews" : "Open active",
    };
  }

  if (followUpCandidates > 0) {
    return {
      ...base,
      status: "follow_up_candidate",
      label: "Follow-up candidates",
      headline: `${followUpCandidates} active application${followUpCandidates === 1 ? "" : "s"} may need timed follow-up.`,
      nextAction: "Draft follow-ups only after reviewing the application context and message approval gate.",
      primaryTab: "active",
      primaryCta: "Review active",
    };
  }

  return {
    ...base,
    status: "clear",
    label: "Ledger current",
    headline: "No application needs immediate action.",
    nextAction: "Keep scouting, preparing applications, and recording employer responses as they arrive.",
    primaryTab: activeApplications > 0 ? "active" : "all",
    primaryCta: activeApplications > 0 ? "Open active" : "All applications",
  };
}
