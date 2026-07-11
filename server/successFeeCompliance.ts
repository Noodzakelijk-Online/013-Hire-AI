import type { SuccessFee } from "../drizzle/schema";

export interface OfferAttributionReviewLike {
  approval?: {
    id?: number;
    applicationId?: number | null;
    entityType?: string | null;
    entityId?: number | null;
    title?: string | null;
    riskLevel?: string | null;
  } | null;
  application?: {
    id?: number;
    jobId?: number;
    job?: {
      title?: string | null;
      company?: string | null;
      location?: string | null;
    } | null;
  } | null;
  latestEmployerResponse?: {
    id?: number;
    responseType?: string | null;
    summary?: string | null;
    receivedAt?: Date | string | null;
  } | null;
}

export type SuccessFeeComplianceStatus = "none" | "clear" | "due_soon" | "needs_attention";
export type SuccessFeeComplianceQueueItemType =
  | "offer_attribution"
  | "verification_pending"
  | "verification_due_soon"
  | "verification_overdue";

export interface SuccessFeeComplianceSummary {
  status: SuccessFeeComplianceStatus;
  activeFees: number;
  pendingVerification: number;
  overdueVerifications: number;
  dueSoonVerifications: number;
  pendingOfferAttributions: number;
  monthlyFeeCents: number;
  nextVerificationDue: Date | null;
  daysUntilNextVerification: number | null;
  label: string;
  nextAction: string;
}

export interface SuccessFeeComplianceQueueItem {
  type: SuccessFeeComplianceQueueItemType;
  priority: "medium" | "high" | "critical";
  action: string;
  successFeeId: number | null;
  approvalId: number | null;
  applicationId: number | null;
  employerName: string | null;
  jobTitle: string | null;
  status: string | null;
  nextVerificationDue: Date | null;
  daysUntilDue: number | null;
  monthlyFeeAmount: number | null;
  responseSummary: string | null;
}

const ACTIVE_FEE_STATUSES = new Set(["active", "pending_verification"]);
const DUE_SOON_DAYS = 14;

function coerceDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysUntil(date: Date | null, now: Date) {
  return date ? Math.ceil((date.getTime() - now.getTime()) / 86_400_000) : null;
}

function isActiveFee(fee: Pick<SuccessFee, "status">) {
  return ACTIVE_FEE_STATUSES.has(fee.status || "");
}

export function getSuccessFeeComplianceSummary(
  fees: Array<Pick<SuccessFee, "status" | "nextVerificationDue" | "monthlyFeeAmount">> = [],
  offerAttributionReviews: OfferAttributionReviewLike[] = [],
  now = new Date()
): SuccessFeeComplianceSummary {
  const activeFees = fees.filter(isActiveFee);
  const verificationDeadlines = activeFees
    .map((fee) => coerceDate(fee.nextVerificationDue))
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => a.getTime() - b.getTime());
  const overdueVerifications = verificationDeadlines.filter((date) => date.getTime() < now.getTime()).length;
  const dueSoonVerifications = verificationDeadlines.filter((date) => {
    const days = daysUntil(date, now);
    return days !== null && days >= 0 && days <= DUE_SOON_DAYS;
  }).length;
  const pendingVerification = activeFees.filter((fee) => fee.status === "pending_verification").length;
  const pendingOfferAttributions = offerAttributionReviews.length;
  const monthlyFeeCents = activeFees.reduce((sum, fee) => sum + (fee.monthlyFeeAmount || 0), 0);
  const nextVerificationDue = verificationDeadlines[0] || null;
  const daysUntilNextVerification = daysUntil(nextVerificationDue, now);

  if (pendingOfferAttributions > 0 || overdueVerifications > 0) {
    return {
      status: "needs_attention",
      activeFees: activeFees.length,
      pendingVerification,
      overdueVerifications,
      dueSoonVerifications,
      pendingOfferAttributions,
      monthlyFeeCents,
      nextVerificationDue,
      daysUntilNextVerification,
      label: "Needs attention",
      nextAction: pendingOfferAttributions > 0
        ? "Review offer attribution and report hires that came through Hire.AI."
        : "Submit overdue employment verification proof.",
    };
  }

  if (pendingVerification > 0 || dueSoonVerifications > 0) {
    return {
      status: "due_soon",
      activeFees: activeFees.length,
      pendingVerification,
      overdueVerifications,
      dueSoonVerifications,
      pendingOfferAttributions,
      monthlyFeeCents,
      nextVerificationDue,
      daysUntilNextVerification,
      label: "Verification pending",
      nextAction: "Keep offer proof and verification documents ready for review.",
    };
  }

  if (activeFees.length > 0) {
    return {
      status: "clear",
      activeFees: activeFees.length,
      pendingVerification,
      overdueVerifications,
      dueSoonVerifications,
      pendingOfferAttributions,
      monthlyFeeCents,
      nextVerificationDue,
      daysUntilNextVerification,
      label: "Current",
      nextAction: "No success-fee compliance action is due right now.",
    };
  }

  return {
    status: "none",
    activeFees: 0,
    pendingVerification: 0,
    overdueVerifications: 0,
    dueSoonVerifications: 0,
    pendingOfferAttributions,
    monthlyFeeCents: 0,
    nextVerificationDue: null,
    daysUntilNextVerification: null,
    label: pendingOfferAttributions > 0 ? "Needs attention" : "No active fees",
    nextAction: pendingOfferAttributions > 0
      ? "Review offer attribution and report hires that came through Hire.AI."
      : "Report a hire only after an offer is accepted.",
  };
}

export function getSuccessFeeComplianceQueue(
  fees: SuccessFee[] = [],
  offerAttributionReviews: OfferAttributionReviewLike[] = [],
  now = new Date()
): SuccessFeeComplianceQueueItem[] {
  const offerItems: SuccessFeeComplianceQueueItem[] = offerAttributionReviews.map((review) => ({
    type: "offer_attribution",
    priority: "high",
    action: "Review offer attribution before success-fee billing continues.",
    successFeeId: null,
    approvalId: review.approval?.id ?? null,
    applicationId: review.approval?.applicationId ?? review.application?.id ?? null,
    employerName: review.application?.job?.company ?? null,
    jobTitle: review.application?.job?.title ?? null,
    status: "pending_offer_attribution",
    nextVerificationDue: null,
    daysUntilDue: null,
    monthlyFeeAmount: null,
    responseSummary: review.latestEmployerResponse?.summary ?? null,
  }));

  const feeItems: SuccessFeeComplianceQueueItem[] = [];
  for (const fee of fees.filter(isActiveFee)) {
    const dueDate = coerceDate(fee.nextVerificationDue);
    const dueInDays = daysUntil(dueDate, now);
    if (dueInDays !== null && dueInDays < 0) {
      feeItems.push({
        type: "verification_overdue",
        priority: "critical",
        action: "Submit overdue employment verification proof.",
        successFeeId: fee.id,
        approvalId: null,
        applicationId: fee.applicationId ?? null,
        employerName: fee.employerName,
        jobTitle: fee.jobTitle,
        status: fee.status,
        nextVerificationDue: dueDate,
        daysUntilDue: dueInDays,
        monthlyFeeAmount: fee.monthlyFeeAmount,
        responseSummary: null,
      });
      continue;
    }
    if (dueInDays !== null && dueInDays <= DUE_SOON_DAYS) {
      feeItems.push({
        type: "verification_due_soon",
        priority: "high",
        action: "Prepare employment verification proof before the deadline.",
        successFeeId: fee.id,
        approvalId: null,
        applicationId: fee.applicationId ?? null,
        employerName: fee.employerName,
        jobTitle: fee.jobTitle,
        status: fee.status,
        nextVerificationDue: dueDate,
        daysUntilDue: dueInDays,
        monthlyFeeAmount: fee.monthlyFeeAmount,
        responseSummary: null,
      });
      continue;
    }
    if (fee.status === "pending_verification") {
      feeItems.push({
        type: "verification_pending",
        priority: "medium",
        action: "Keep offer proof and verification documents ready for review.",
        successFeeId: fee.id,
        approvalId: null,
        applicationId: fee.applicationId ?? null,
        employerName: fee.employerName,
        jobTitle: fee.jobTitle,
        status: fee.status,
        nextVerificationDue: dueDate,
        daysUntilDue: dueInDays,
        monthlyFeeAmount: fee.monthlyFeeAmount,
        responseSummary: null,
      });
    }
  }

  const priorityRank = { critical: 0, high: 1, medium: 2 };
  return [...offerItems, ...feeItems].sort((a, b) => {
    const priorityDelta = priorityRank[a.priority] - priorityRank[b.priority];
    if (priorityDelta !== 0) return priorityDelta;
    return (a.daysUntilDue ?? Number.MAX_SAFE_INTEGER) - (b.daysUntilDue ?? Number.MAX_SAFE_INTEGER);
  });
}
