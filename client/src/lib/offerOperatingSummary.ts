import { isOfferEligibleApplicationStatus } from "@shared/offerEligibility";

export type OfferOperatingStatus =
  | "not_applicable"
  | "offer_decision"
  | "attribution_review"
  | "report_hire"
  | "verification_pending"
  | "fee_active"
  | "fee_closed"
  | "fee_attention";

export interface OfferApplicationLike {
  status?: string | null;
}

export interface OfferAttributionReviewLike {
  approval?: {
    status?: string | null;
  } | null;
}

export interface SuccessFeeLike {
  status?: string | null;
  monthlyFeeAmount?: number | null;
  nextVerificationDue?: Date | string | null;
}

export interface OfferOperatingSummary {
  status: OfferOperatingStatus;
  label: string;
  nextAction: string;
  canReportHire: boolean;
  hasOfferAttributionReview: boolean;
  hasSuccessFee: boolean;
  monthlyFeeCents: number;
  nextVerificationDue: Date | null;
}

function asDate(value?: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getOfferOperatingSummary(
  application: OfferApplicationLike | null | undefined,
  offerAttributionReview?: OfferAttributionReviewLike | null,
  successFee?: SuccessFeeLike | null
): OfferOperatingSummary {
  const applicationStatus = application?.status || "pending";
  const feeStatus = successFee?.status || null;
  const hasOfferAttributionReview = Boolean(
    offerAttributionReview && offerAttributionReview.approval?.status !== "approved"
  );
  const hasSuccessFee = Boolean(successFee);
  const monthlyFeeCents = successFee?.monthlyFeeAmount || 0;
  const nextVerificationDue = asDate(successFee?.nextVerificationDue);
  const base = {
    hasOfferAttributionReview,
    hasSuccessFee,
    monthlyFeeCents,
    nextVerificationDue,
  };

  const offerLifecycleActive = isOfferEligibleApplicationStatus(applicationStatus);
  const acceptanceConfirmed = applicationStatus === "accepted";

  if (hasOfferAttributionReview && offerLifecycleActive) {
    return {
      ...base,
      status: "attribution_review",
      label: "Offer attribution",
      nextAction: acceptanceConfirmed
        ? "Review whether this offer came from Hire.AI activity, then report the hire with offer-letter proof."
        : "Confirm acceptance or decline the offer before it can be reported as a hire.",
      canReportHire: acceptanceConfirmed,
    };
  }

  if (feeStatus === "pending_verification") {
    return {
      ...base,
      status: "verification_pending",
      label: "Verification pending",
      nextAction: "Initial offer proof is stored. Keep verification current before the success-fee arrangement becomes active.",
      canReportHire: false,
    };
  }

  if (feeStatus === "active") {
    return {
      ...base,
      status: "fee_active",
      label: "Success fee active",
      nextAction: "Keep quarterly employment verification and billing records current.",
      canReportHire: false,
    };
  }

  if (feeStatus === "suspended" || feeStatus === "disputed") {
    return {
      ...base,
      status: "fee_attention",
      label: "Compliance review",
      nextAction: "Resolve the suspended or disputed success-fee record through admin review before taking further action.",
      canReportHire: false,
    };
  }

  if (feeStatus === "paused" || feeStatus === "ended") {
    return {
      ...base,
      status: "fee_closed",
      label: "Fee closed",
      nextAction: "Keep the offer, verification, and billing audit trail for reference.",
      canReportHire: false,
    };
  }

  if (acceptanceConfirmed) {
    return {
      ...base,
      status: "report_hire",
      label: "Report hire",
      nextAction: "Upload the offer letter and accept success-fee terms before billing is set up.",
      canReportHire: true,
    };
  }

  if (offerLifecycleActive) {
    return {
      ...base,
      status: "offer_decision",
      label: "Offer decision",
      nextAction: "Confirm acceptance or decline the offer before reporting any hire or billing activity.",
      canReportHire: false,
    };
  }

  return {
    ...base,
    status: "not_applicable",
    label: "No offer action",
    nextAction: "Record an employer offer before success-fee attribution is reviewed.",
    canReportHire: false,
  };
}
