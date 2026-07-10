import type { ApplicationLedgerSummary } from "./applicationLedgerSummary";
import type { InterviewOperatingSummary } from "./interviewOperatingSummary";
import type { OfferOperatingSummary } from "./offerOperatingSummary";

export type ApplicationNextActionId =
  | "review_queue"
  | "resolve_evidence"
  | "confirm_submission"
  | "record_response"
  | "draft_follow_up"
  | "schedule_interview"
  | "confirm_offer_acceptance"
  | "report_hire"
  | "view_audit"
  | "monitor";

export type ApplicationNextActionRisk = "low" | "medium" | "high";

export interface ApplicationNextAction {
  id: ApplicationNextActionId;
  label: string;
  detail: string;
  risk: ApplicationNextActionRisk;
  requiresApproval: boolean;
}

export interface ApplicationNextActionsInput {
  ledgerSummary?: ApplicationLedgerSummary | null;
  interviewSummary?: InterviewOperatingSummary | null;
  offerSummary?: OfferOperatingSummary | null;
  application?: {
    status?: string | null;
  } | null;
  canGenerateFollowUp?: boolean;
  approvedFollowUpReadyToSend?: boolean;
  evidenceGateCount?: number;
}

export interface ApplicationNextActionsSummary {
  headline: string;
  detail: string;
  primary: ApplicationNextAction;
  secondary: ApplicationNextAction[];
  attentionCount: number;
}

const actionLibrary: Record<ApplicationNextActionId, ApplicationNextAction> = {
  review_queue: {
    id: "review_queue",
    label: "Open review queue",
    detail: "Resolve the approval or review item before Hire.AI advances this application.",
    risk: "medium",
    requiresApproval: true,
  },
  resolve_evidence: {
    id: "resolve_evidence",
    label: "Resolve evidence",
    detail: "Complete profile or connector evidence gates before Hire.AI advances external application or follow-up work.",
    risk: "high",
    requiresApproval: false,
  },
  confirm_submission: {
    id: "confirm_submission",
    label: "Confirm submission",
    detail: "Store deterministic portal, ATS, or email evidence before marking the application submitted.",
    risk: "high",
    requiresApproval: true,
  },
  record_response: {
    id: "record_response",
    label: "Record response",
    detail: "Classify the employer reply so the ledger can route interview, offer, rejection, or reply work.",
    risk: "low",
    requiresApproval: false,
  },
  draft_follow_up: {
    id: "draft_follow_up",
    label: "Draft follow-up",
    detail: "Generate an internal follow-up draft; external sending remains approval-gated.",
    risk: "medium",
    requiresApproval: true,
  },
  schedule_interview: {
    id: "schedule_interview",
    label: "Schedule interview",
    detail: "Capture the agreed time, channel, interviewer context, and preparation state.",
    risk: "medium",
    requiresApproval: false,
  },
  confirm_offer_acceptance: {
    id: "confirm_offer_acceptance",
    label: "Confirm offer acceptance",
    detail: "Record your explicit acceptance in the application ledger before Hire.AI advances the hire workflow.",
    risk: "high",
    requiresApproval: true,
  },
  report_hire: {
    id: "report_hire",
    label: "Report hire",
    detail: "Upload offer proof and accept success-fee terms before billing is configured.",
    risk: "high",
    requiresApproval: true,
  },
  view_audit: {
    id: "view_audit",
    label: "Review audit trail",
    detail: "Inspect the evidence, attempts, responses, follow-ups, and audit events for this application.",
    risk: "low",
    requiresApproval: false,
  },
  monitor: {
    id: "monitor",
    label: "Monitor",
    detail: "No user action is due; Hire.AI should keep watching for responses or stale follow-up timing.",
    risk: "low",
    requiresApproval: false,
  },
};

function uniqueActions(actions: ApplicationNextAction[]) {
  const seen = new Set<ApplicationNextActionId>();
  return actions.filter((action) => {
    if (seen.has(action.id)) return false;
    seen.add(action.id);
    return true;
  });
}

function getPrimaryAction(input: ApplicationNextActionsInput): ApplicationNextAction {
  const ledger = input.ledgerSummary;
  const interview = input.interviewSummary;
  const offer = input.offerSummary;

  if (offer?.status === "fee_attention" || offer?.status === "attribution_review") {
    return actionLibrary.review_queue;
  }

  if (input.application?.status === "offer") {
    return actionLibrary.confirm_offer_acceptance;
  }

  if (offer?.canReportHire) {
    return actionLibrary.report_hire;
  }

  if (ledger?.status === "approval_blocked" || input.approvedFollowUpReadyToSend) {
    return actionLibrary.review_queue;
  }

  if ((input.evidenceGateCount || 0) > 0) {
    const status = input.application?.status || "";
    const blocksSubmission = status === "pending" && ledger?.approvedSubmission && !ledger.hasSubmissionEvidence;
    if (blocksSubmission) {
      return actionLibrary.resolve_evidence;
    }
  }

  if (ledger?.approvedSubmission && !ledger.hasSubmissionEvidence) {
    return actionLibrary.confirm_submission;
  }

  if (interview?.canSchedule && interview.status === "needs_scheduling") {
    return actionLibrary.schedule_interview;
  }

  if (ledger?.status === "response_received") {
    return actionLibrary.record_response;
  }

  if (ledger?.status === "follow_up_review") {
    return actionLibrary.review_queue;
  }

  if (input.canGenerateFollowUp && ledger?.status === "follow_up_due") {
    return actionLibrary.draft_follow_up;
  }

  if (ledger?.status === "closed") {
    return actionLibrary.view_audit;
  }

  return actionLibrary.monitor;
}

export function getApplicationNextActions(input: ApplicationNextActionsInput): ApplicationNextActionsSummary {
  const ledger = input.ledgerSummary;
  const interview = input.interviewSummary;
  const offer = input.offerSummary;
  const primary = getPrimaryAction(input);

  const secondaryCandidates: ApplicationNextAction[] = [];

  if (ledger?.auditEventCount) {
    secondaryCandidates.push(actionLibrary.view_audit);
  }

  if (offer?.status === "attribution_review" || offer?.status === "fee_attention") {
    secondaryCandidates.push(actionLibrary.review_queue);
  }

  if (offer?.canReportHire) {
    secondaryCandidates.push(actionLibrary.report_hire);
  }

  if ((input.evidenceGateCount || 0) > 0) {
    secondaryCandidates.push(actionLibrary.resolve_evidence);
  }

  if (interview?.canSchedule) {
    secondaryCandidates.push(actionLibrary.schedule_interview);
  }

  if (input.application?.status === "offer") {
    secondaryCandidates.push(actionLibrary.confirm_offer_acceptance);
  }

  if (ledger?.approvedSubmission && !ledger.hasSubmissionEvidence) {
    secondaryCandidates.push(actionLibrary.confirm_submission);
  }

  if (input.canGenerateFollowUp && !ledger?.sentFollowUpsAwaitingResponse) {
    secondaryCandidates.push(actionLibrary.draft_follow_up);
  }

  const applicationStatus = input.application?.status || "";
  if (!["pending", "withdrawn", "rejected", "accepted"].includes(applicationStatus)) {
    secondaryCandidates.push(actionLibrary.record_response);
  }

  if (ledger?.pendingApproval || ledger?.rejectedSubmission || input.approvedFollowUpReadyToSend || ledger?.openFollowUpDrafts) {
    secondaryCandidates.push(actionLibrary.review_queue);
  }

  const secondary = uniqueActions(secondaryCandidates)
    .filter((action) => action.id !== primary.id)
    .slice(0, 3);

  const attentionCount = [
    ledger?.pendingApproval,
    ledger?.rejectedSubmission,
    ledger?.openFollowUpDrafts && ledger.openFollowUpDrafts > 0,
    input.approvedFollowUpReadyToSend,
    (input.evidenceGateCount || 0) > 0,
    ledger?.approvedSubmission && !ledger.hasSubmissionEvidence,
    interview?.status === "needs_scheduling",
    input.application?.status === "offer",
    offer?.status === "attribution_review",
    offer?.status === "fee_attention",
    offer?.canReportHire,
  ].filter(Boolean).length;

  return {
    headline: primary.label,
    detail: primary.detail,
    primary,
    secondary,
    attentionCount,
  };
}
