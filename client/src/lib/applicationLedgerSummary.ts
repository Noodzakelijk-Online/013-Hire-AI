export interface ApplicationLedgerApplicationLike {
  status?: string | null;
  appliedDate?: Date | string | null;
  createdAt?: Date | string | null;
}

export interface ApplicationLedgerAttemptLike {
  status?: string | null;
  confirmationText?: string | null;
  confirmationUrl?: string | null;
}

export interface ApplicationLedgerArtifactsLike {
  material?: unknown | null;
  attempts?: ApplicationLedgerAttemptLike[] | null;
  employerResponses?: unknown[] | null;
  auditEvents?: ApplicationLedgerAuditEventLike[] | null;
}

export interface ApplicationLedgerApprovalLike {
  status?: string | null;
}

export interface ApplicationLedgerFollowUpLike {
  sentDate?: Date | string | null;
  responseReceived?: number | boolean | null;
}

export interface ApplicationLedgerAuditEventLike {
  action?: string | null;
  afterState?: string | null;
}

export type ApplicationLedgerSummaryStatus =
  | "approval_blocked"
  | "evidence_required"
  | "ready_for_submission"
  | "follow_up_review"
  | "follow_up_due"
  | "response_received"
  | "offer_action"
  | "closed"
  | "in_progress";

export interface ApplicationLedgerSummary {
  status: ApplicationLedgerSummaryStatus;
  label: string;
  nextAction: string;
  hasPreparedMaterial: boolean;
  hasSubmissionEvidence: boolean;
  hasEmployerResponse: boolean;
  pendingApproval: boolean;
  approvedSubmission: boolean;
  rejectedSubmission: boolean;
  openFollowUpDrafts: number;
  sentFollowUpsAwaitingResponse: number;
  staleFollowUpCancellations: number;
  staleFollowUpCancellationReason: string | null;
  auditEventCount: number;
}

function hasDeterministicEvidence(attempt: ApplicationLedgerAttemptLike) {
  return attempt.status === "submitted" && Boolean(
    attempt.confirmationText?.trim() || attempt.confirmationUrl?.trim()
  );
}

function parseJsonObject(value?: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function getStaleFollowUpCancellation(events: ApplicationLedgerAuditEventLike[]) {
  const event = events.find((item) => item.action === "stale_follow_up_approvals_cancelled");
  if (!event) {
    return { count: 0, reason: null as string | null };
  }

  const afterState = parseJsonObject(event.afterState);
  const cancelledApprovalIds = Array.isArray(afterState?.cancelledApprovalIds)
    ? afterState.cancelledApprovalIds
    : [];
  const responseType = typeof afterState?.responseType === "string"
    ? afterState.responseType.replace(/_/g, " ")
    : "employer response";
  const article = /^[aeiou]/i.test(responseType) ? "an" : "a";

  return {
    count: Math.max(cancelledApprovalIds.length, 1),
    reason: `Hire.AI retired a stale follow-up approval after ${article} ${responseType} arrived.`,
  };
}

export function getApplicationLedgerSummary(
  application: ApplicationLedgerApplicationLike,
  artifacts: ApplicationLedgerArtifactsLike | null | undefined,
  submissionApproval?: ApplicationLedgerApprovalLike | null,
  followUps: ApplicationLedgerFollowUpLike[] = []
): ApplicationLedgerSummary {
  const status = application.status || "pending";
  const attempts = artifacts?.attempts || [];
  const hasPreparedMaterial = Boolean(artifacts?.material);
  const hasSubmissionEvidence = attempts.some(hasDeterministicEvidence);
  const hasEmployerResponse = (artifacts?.employerResponses?.length || 0) > 0;
  const auditEvents = artifacts?.auditEvents || [];
  const pendingApproval = submissionApproval?.status === "pending";
  const approvedSubmission = submissionApproval?.status === "approved";
  const rejectedSubmission = submissionApproval?.status === "rejected" || submissionApproval?.status === "cancelled";
  const openFollowUpDrafts = followUps.filter((followUp) => !followUp.sentDate).length;
  const sentFollowUpsAwaitingResponse = followUps.filter((followUp) =>
    Boolean(followUp.sentDate) && !followUp.responseReceived
  ).length;
  const auditEventCount = auditEvents.length;
  const staleFollowUp = getStaleFollowUpCancellation(auditEvents);

  const base = {
    hasPreparedMaterial,
    hasSubmissionEvidence,
    hasEmployerResponse,
    pendingApproval,
    approvedSubmission,
    rejectedSubmission,
    openFollowUpDrafts,
    sentFollowUpsAwaitingResponse,
    staleFollowUpCancellations: staleFollowUp.count,
    staleFollowUpCancellationReason: staleFollowUp.reason,
    auditEventCount,
  };

  if (status === "offer" || status === "accepted") {
    return {
      ...base,
      status: "offer_action",
      label: status === "accepted" ? "Hire reported" : "Offer review",
      nextAction: status === "accepted"
        ? "Keep success-fee billing and verification records current."
        : "Review offer attribution and report the hire only after the offer is accepted.",
    };
  }

  if (status === "rejected" || status === "withdrawn") {
    return {
      ...base,
      status: "closed",
      label: "Closed",
      nextAction: "No outreach is due; keep the audit trail and response history for reference.",
    };
  }

  if (pendingApproval || rejectedSubmission) {
    return {
      ...base,
      status: "approval_blocked",
      label: rejectedSubmission ? "Approval blocked" : "Approval needed",
      nextAction: rejectedSubmission
        ? "Resolve the rejected or cancelled approval before any submission can be confirmed."
        : "Approve or reject the external submission request before anything leaves Hire.AI.",
    };
  }

  if (status === "pending") {
    if (!hasSubmissionEvidence) {
      return {
        ...base,
        status: approvedSubmission ? "evidence_required" : "ready_for_submission",
        label: approvedSubmission ? "Evidence required" : "Prepared",
        nextAction: approvedSubmission
          ? "Confirm submission only after deterministic employer portal, ATS, or email evidence exists."
          : "Review the prepared material, then request approval before confirming an external submission.",
      };
    }

    return {
      ...base,
      status: "in_progress",
      label: "Submitted evidence",
      nextAction: "Submission evidence is present; wait for an employer response or schedule follow-up.",
    };
  }

  if (hasEmployerResponse) {
    return {
      ...base,
      status: "response_received",
      label: "Response recorded",
      nextAction: "Use the latest employer response to update interview, offer, or rejection state.",
    };
  }

  if (openFollowUpDrafts > 0) {
    return {
      ...base,
      status: "follow_up_review",
      label: "Follow-up review",
      nextAction: "Approve or reject the follow-up draft before marking it sent.",
    };
  }

  if (status === "applied" || status === "viewed" || status === "interview") {
    return {
      ...base,
      status: sentFollowUpsAwaitingResponse > 0 ? "in_progress" : "follow_up_due",
      label: sentFollowUpsAwaitingResponse > 0 ? "Awaiting reply" : "Follow-up candidate",
      nextAction: sentFollowUpsAwaitingResponse > 0
        ? "A follow-up has been sent; record the employer response when it arrives."
        : "Draft a follow-up when the employer has been silent long enough.",
    };
  }

  return {
    ...base,
    status: "in_progress",
    label: "In progress",
    nextAction: "Continue tracking approvals, evidence, responses, and follow-ups in the ledger.",
  };
}
