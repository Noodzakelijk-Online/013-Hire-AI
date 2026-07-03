import {
  type OperatingReviewQueueInput,
  getOperatingReviewQueueCounts,
} from "./operatingReviewQueue";
import {
  getSuccessFeeComplianceAction,
  type SuccessFeeComplianceSummary,
} from "./successFeeCompliance";

export type CommandCenterStatus =
  | "blocked"
  | "approval_required"
  | "attention"
  | "ready"
  | "clear";

export interface CommandCenterSummary {
  status: CommandCenterStatus;
  label: string;
  headline: string;
  nextAction: string;
  primaryCta: string;
  primaryRoute: string;
  secondaryCta: string;
  secondaryRoute: string;
  openActions: number;
  profileBlockers: number;
  approvalItems: number;
  reviewItems: number;
  complianceItems: number;
  interviewSchedulingNeeded: number;
  interviewPreparationNeeded: number;
  employerResponsesNeedingReply: number;
  followUpsDue: number;
  approvedFollowUpsReadyToSend: number;
  connectorReadiness: number;
  preparedApplications: number;
  dailyRemaining: number | null;
}

export interface CommandCenterLedgerInput extends OperatingReviewQueueInput {
  canReviewAdminItems?: boolean | null;
  readiness?: OperatingReviewQueueInput["readiness"] & {
    score?: number | null;
    autoApplyEligible?: boolean | null;
  } | null;
  metrics?: {
    preparedApplications?: number | null;
    pendingApprovals?: number | null;
    openAdminReviews?: number | null;
    reviewRequiredDecisions?: number | null;
    interviewSchedulingNeeded?: number | null;
    interviewPreparationNeeded?: number | null;
    employerResponsesNeedingReply?: number | null;
    followUpsDue?: number | null;
    approvedFollowUpsReadyToSend?: number | null;
    connectorReadiness?: number | null;
    dailyRemaining?: number | null;
  } | null;
  nextActions?: string[] | null;
}

function positiveNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function complianceActionCount(summary?: SuccessFeeComplianceSummary | null) {
  if (!summary) return 0;
  return (
    positiveNumber(summary.pendingOfferAttributions) +
    positiveNumber(summary.overdueVerifications) +
    positiveNumber(summary.pendingVerification) +
    positiveNumber(summary.dueSoonVerifications)
  );
}

export function getCommandCenterSummary(
  ledger?: CommandCenterLedgerInput | null,
  compliance?: SuccessFeeComplianceSummary | null
): CommandCenterSummary {
  const queueCounts = getOperatingReviewQueueCounts(ledger);
  const profileBlockers = queueCounts.profileBlockers;
  const approvalItems = positiveNumber(ledger?.metrics?.pendingApprovals) || queueCounts.pendingApprovals;
  const adminReviewItems = ledger?.canReviewAdminItems === true
    ? positiveNumber(ledger?.metrics?.openAdminReviews)
    : 0;
  const reviewItems =
    adminReviewItems +
    positiveNumber(ledger?.metrics?.reviewRequiredDecisions) +
    queueCounts.profileWarnings;
  const interviewSchedulingNeeded =
    positiveNumber(ledger?.metrics?.interviewSchedulingNeeded) || queueCounts.interviewScheduling;
  const interviewPreparationNeeded =
    positiveNumber(ledger?.metrics?.interviewPreparationNeeded) || queueCounts.interviewPreparationNeeded;
  const employerResponsesNeedingReply =
    positiveNumber(ledger?.metrics?.employerResponsesNeedingReply) || queueCounts.employerResponsesNeedingReply;
  const followUpsDue = positiveNumber(ledger?.metrics?.followUpsDue) || queueCounts.followUpsDue;
  const approvedFollowUpsReadyToSend =
    positiveNumber(ledger?.metrics?.approvedFollowUpsReadyToSend) || queueCounts.approvedFollowUpsReadyToSend;
  const connectorReadiness =
    positiveNumber(ledger?.metrics?.connectorReadiness) || queueCounts.connectorReadiness;
  const preparedApplications = positiveNumber(ledger?.metrics?.preparedApplications);
  const complianceItems = complianceActionCount(compliance);
  const dailyRemaining = typeof ledger?.metrics?.dailyRemaining === "number"
    ? ledger.metrics.dailyRemaining
    : null;
  const complianceAction = compliance ? getSuccessFeeComplianceAction(compliance) : null;
  const openActions =
    profileBlockers +
    approvalItems +
    reviewItems +
    complianceItems +
    interviewSchedulingNeeded +
    interviewPreparationNeeded +
    employerResponsesNeedingReply +
    followUpsDue +
    approvedFollowUpsReadyToSend +
    connectorReadiness +
    preparedApplications;

  const base = {
    openActions,
    profileBlockers,
    approvalItems,
    reviewItems,
    complianceItems,
    interviewSchedulingNeeded,
    interviewPreparationNeeded,
    employerResponsesNeedingReply,
    followUpsDue,
    approvedFollowUpsReadyToSend,
    connectorReadiness,
    preparedApplications,
    dailyRemaining,
  };

  if (profileBlockers > 0 || ledger?.readiness?.autoApplyEligible === false) {
    return {
      ...base,
      status: "blocked",
      label: "Profile blocked",
      headline: "Automation is paused until profile evidence is stronger.",
      nextAction: ledger?.readiness?.blockers?.[0]
        ? String((ledger.readiness.blockers[0] as { recommendation?: string }).recommendation || "Complete the missing profile evidence before approving submissions.")
        : "Complete the missing profile evidence before approving submissions.",
      primaryCta: "Fix Profile",
      primaryRoute: "/profile",
      secondaryCta: "Review Queue",
      secondaryRoute: "/review-queue",
    };
  }

  if (approvalItems > 0) {
    return {
      ...base,
      status: "approval_required",
      label: "Approval needed",
      headline: `${approvalItems} consequential action${approvalItems === 1 ? "" : "s"} need your decision.`,
      nextAction: "Approve or reject prepared submissions, follow-ups, interviews, or offer attribution before anything external happens.",
      primaryCta: "Open Review Queue",
      primaryRoute: "/review-queue",
      secondaryCta: "Open Ledger",
      secondaryRoute: "/applications",
    };
  }

  if (compliance?.status === "needs_attention") {
    return {
      ...base,
      status: "attention",
      label: "Compliance attention",
      headline: complianceAction
        ? `${complianceAction.label} needs review.`
        : "Success-fee or offer attribution work needs review.",
      nextAction: complianceAction?.detail || compliance.nextAction,
      primaryCta: complianceAction?.cta || "Open Billing",
      primaryRoute: complianceAction?.route || "/billing",
      secondaryCta: complianceAction?.route === "/review-queue" ? "Open Billing" : "Review Queue",
      secondaryRoute: complianceAction?.route === "/review-queue" ? "/billing" : "/review-queue",
    };
  }

  if (reviewItems > 0) {
    return {
      ...base,
      status: "attention",
      label: "Review queue",
      headline: `${reviewItems} review item${reviewItems === 1 ? "" : "s"} should be cleared before more automation.`,
      nextAction: "Review uncertain matches, profile warnings, and admin-visible operating items.",
      primaryCta: "Open Review Queue",
      primaryRoute: "/review-queue",
      secondaryCta: "Improve Profile",
      secondaryRoute: "/profile",
    };
  }

  if (connectorReadiness > 0) {
    return {
      ...base,
      status: "attention",
      label: "Connector readiness",
      headline: `${connectorReadiness} connector setup item${connectorReadiness === 1 ? "" : "s"} need attention.`,
      nextAction: "Complete inbox or cloud connector setup from Profile before Hire.AI depends on external replies or document discovery.",
      primaryCta: "Open Profile",
      primaryRoute: "/profile",
      secondaryCta: "Review Queue",
      secondaryRoute: "/review-queue",
    };
  }

  if (interviewSchedulingNeeded > 0) {
    return {
      ...base,
      status: "attention",
      label: "Interview scheduling",
      headline: `${interviewSchedulingNeeded} interview invite${interviewSchedulingNeeded === 1 ? "" : "s"} need scheduling.`,
      nextAction: "Turn employer interview invites into scheduled interviews with time, channel, and interviewer context before follow-up automation continues.",
      primaryCta: "Open Review Queue",
      primaryRoute: "/review-queue",
      secondaryCta: "Open Applications",
      secondaryRoute: "/applications",
    };
  }

  if (interviewPreparationNeeded > 0) {
    return {
      ...base,
      status: "attention",
      label: "Interview prep",
      headline: `${interviewPreparationNeeded} upcoming interview${interviewPreparationNeeded === 1 ? "" : "s"} need preparation.`,
      nextAction: "Generate evidence-backed interview preparation before the scheduled interview starts.",
      primaryCta: "Open Review Queue",
      primaryRoute: "/review-queue",
      secondaryCta: "Open Applications",
      secondaryRoute: "/applications",
    };
  }

  if (employerResponsesNeedingReply > 0) {
    return {
      ...base,
      status: "attention",
      label: "Employer reply",
      headline: `${employerResponsesNeedingReply} employer response${employerResponsesNeedingReply === 1 ? "" : "s"} need a reply or classification.`,
      nextAction: "Review employer questions or ambiguous responses in the application ledger before routine follow-up automation continues.",
      primaryCta: "Open Review Queue",
      primaryRoute: "/review-queue",
      secondaryCta: "Open Applications",
      secondaryRoute: "/applications",
    };
  }

  if (approvedFollowUpsReadyToSend > 0) {
    return {
      ...base,
      status: "attention",
      label: "Send handoff",
      headline: `${approvedFollowUpsReadyToSend} approved follow-up draft${approvedFollowUpsReadyToSend === 1 ? "" : "s"} need send confirmation.`,
      nextAction: "Send approved drafts through the intended external channel, then mark them sent in the application ledger.",
      primaryCta: "Open Review Queue",
      primaryRoute: "/review-queue",
      secondaryCta: "Open Applications",
      secondaryRoute: "/applications",
    };
  }

  if (followUpsDue > 0) {
    return {
      ...base,
      status: "attention",
      label: "Follow-up due",
      headline: `${followUpsDue} employer follow-up${followUpsDue === 1 ? "" : "s"} can be drafted.`,
      nextAction: "Draft follow-ups for quiet applications, then approve sending only after review.",
      primaryCta: "Open Applications",
      primaryRoute: "/applications",
      secondaryCta: "Scan Jobs",
      secondaryRoute: "/dashboard",
    };
  }

  if (preparedApplications > 0) {
    return {
      ...base,
      status: "ready",
      label: "Prepared work",
      headline: `${preparedApplications} prepared application${preparedApplications === 1 ? "" : "s"} need evidence or review.`,
      nextAction: "Open each prepared application and confirm submission only when deterministic evidence exists.",
      primaryCta: "Open Ledger",
      primaryRoute: "/applications",
      secondaryCta: "Review Queue",
      secondaryRoute: "/review-queue",
    };
  }

  if (dailyRemaining === 0) {
    return {
      ...base,
      status: "clear",
      label: "Daily limit reached",
      headline: "Today's application limit is used up.",
      nextAction: "Wait for the next cycle or adjust the daily limit in automation policy.",
      primaryCta: "Adjust Policy",
      primaryRoute: "/ai-preferences",
      secondaryCta: "Open Ledger",
      secondaryRoute: "/applications",
    };
  }

  return {
    ...base,
    status: "clear",
    label: "Ready",
    headline: "No urgent blockers are waiting for you.",
    nextAction: "Run a scan to find new matches, or review the ledger for recent activity.",
    primaryCta: "Scan Jobs",
    primaryRoute: "/dashboard",
    secondaryCta: "Open Ledger",
    secondaryRoute: "/applications",
  };
}
