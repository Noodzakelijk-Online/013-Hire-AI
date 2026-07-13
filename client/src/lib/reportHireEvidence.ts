export type ReportHireEvidenceState = "complete" | "pending" | "review";
export type ReportHireEvidenceStatus = "ready" | "needs_proof" | "needs_terms" | "unlinked_review" | "application_not_accepted";
export type ReportHireEvidenceRisk = "high" | "critical";

export interface ReportHireApplicationLike {
  id?: number | null;
  status?: string | null;
  job?: {
    title?: string | null;
    company?: string | null;
  } | null;
}

export interface ReportHireAttributionReviewLike {
  approval?: {
    id?: number | null;
    status?: string | null;
    riskLevel?: string | null;
    description?: string | null;
  } | null;
  latestEmployerResponse?: {
    summary?: string | null;
    source?: string | null;
    receivedAt?: Date | string | null;
  } | null;
}

export interface ReportHireEvidenceCheckpoint {
  id: "application_link" | "offer_response" | "offer_proof" | "terms" | "admin_review";
  label: string;
  state: ReportHireEvidenceState;
  detail: string;
}

export interface ReportHireEvidenceInput {
  application?: ReportHireApplicationLike | null;
  attributionReview?: ReportHireAttributionReviewLike | null;
  hasOfferLetter: boolean;
  termsAccepted: boolean;
}

export interface ReportHireEvidenceSummary {
  status: ReportHireEvidenceStatus;
  label: string;
  nextAction: string;
  risk: ReportHireEvidenceRisk;
  approvalGated: true;
  canContinueToTerms: boolean;
  canConfirm: boolean;
  checkpoints: ReportHireEvidenceCheckpoint[];
}

export interface ReportHireResultLike {
  feeId?: number | null;
  monthlyFeeAmount?: number | null;
  subscriptionStatus?: string | null;
  stripeSubscriptionId?: string | null;
  checkoutUrl?: string | null;
  ledger?: {
    offerProofStatus?: string | null;
    offerAttributionStatus?: string | null;
    verificationStatus?: string | null;
    billingSetupStatus?: string | null;
    adminReviewRequired?: boolean | null;
  } | null;
}

export interface ReportHireCompletionItem {
  id: "offer_proof" | "offer_attribution" | "verification" | "billing";
  label: string;
  state: ReportHireEvidenceState;
  detail: string;
}

export interface ReportHireCompletionSummary {
  label: string;
  nextAction: string;
  feeId: number | null;
  monthlyFeeCents: number;
  paymentActionRequired: boolean;
  adminReviewRequired: boolean;
  items: ReportHireCompletionItem[];
}

function hasAcceptedOfferStatus(application?: ReportHireApplicationLike | null) {
  return application?.status === "accepted";
}

export function getReportHireEvidenceSummary(input: ReportHireEvidenceInput): ReportHireEvidenceSummary {
  const linkedApplication = Boolean(input.application?.id);
  const hasOfferResponse = Boolean(input.attributionReview?.latestEmployerResponse?.summary);
  const applicationLooksOfferReady = hasAcceptedOfferStatus(input.application);

  const checkpoints: ReportHireEvidenceCheckpoint[] = [
    {
      id: "application_link",
      label: "Application link",
      state: linkedApplication ? "complete" : "review",
      detail: linkedApplication
        ? "The hire is linked to a Hire.AI application ledger."
        : "No application is linked, so admin must review attribution before relying on this report.",
    },
    {
      id: "offer_response",
      label: "Offer signal",
      state: hasOfferResponse || applicationLooksOfferReady ? "complete" : "review",
      detail: hasOfferResponse
        ? "An employer offer response is already connected to this application."
        : applicationLooksOfferReady
          ? "The linked application records a confirmed offer acceptance."
          : "Offer acceptance must be confirmed before a linked hire can be reported.",
    },
    {
      id: "offer_proof",
      label: "Offer proof",
      state: input.hasOfferLetter ? "complete" : "pending",
      detail: input.hasOfferLetter
        ? "Offer-letter proof is selected for secure upload."
        : "Upload an offer letter or equivalent written offer before continuing.",
    },
    {
      id: "terms",
      label: "Success-fee terms",
      state: input.termsAccepted ? "complete" : "pending",
      detail: input.termsAccepted
        ? "The user has accepted the success-fee terms for this report."
        : "The user must explicitly accept success-fee terms before billing setup.",
    },
    {
      id: "admin_review",
      label: "Admin review",
      state: "review",
      detail: "Submitting creates an audit event and admin review item for offer attribution and proof review.",
    },
  ];

  if (linkedApplication && !applicationLooksOfferReady) {
    return {
      status: "application_not_accepted",
      label: "Acceptance required",
      nextAction: "Confirm offer acceptance before reporting a hire against this linked application.",
      risk: "high",
      approvalGated: true,
      canContinueToTerms: false,
      canConfirm: false,
      checkpoints,
    };
  }

  if (!input.hasOfferLetter) {
    return {
      status: "needs_proof",
      label: "Proof required",
      nextAction: "Upload offer-letter proof before Hire.AI can create the report-hire ledger entry.",
      risk: linkedApplication ? "high" : "critical",
      approvalGated: true,
      canContinueToTerms: false,
      canConfirm: false,
      checkpoints,
    };
  }

  if (!input.termsAccepted) {
    return {
      status: "needs_terms",
      label: "Terms required",
      nextAction: "Review and accept the success-fee terms before Stripe setup is approved.",
      risk: linkedApplication ? "high" : "critical",
      approvalGated: true,
      canContinueToTerms: true,
      canConfirm: false,
      checkpoints,
    };
  }

  if (!linkedApplication) {
    return {
      status: "unlinked_review",
      label: "Unlinked review",
      nextAction: "This can be reported, but attribution remains high-risk until admin reviews the proof.",
      risk: "critical",
      approvalGated: true,
      canContinueToTerms: true,
      canConfirm: true,
      checkpoints,
    };
  }

  return {
    status: "ready",
    label: "Ready to report",
    nextAction: "Submit the report to store proof, approvals, audit events, and the success-fee compliance record.",
    risk: "high",
    approvalGated: true,
    canContinueToTerms: true,
    canConfirm: true,
    checkpoints,
  };
}

export function getReportHireCompletionSummary(
  result?: ReportHireResultLike | null
): ReportHireCompletionSummary {
  const ledger = result?.ledger;
  const paymentActionRequired = Boolean(result?.checkoutUrl) ||
    ledger?.billingSetupStatus === "checkout_required" ||
    result?.subscriptionStatus === "checkout_open";
  const adminReviewRequired = ledger?.adminReviewRequired !== false;
  const feeId = typeof result?.feeId === "number" ? result.feeId : null;
  const monthlyFeeCents = result?.monthlyFeeAmount || 0;

  const items: ReportHireCompletionItem[] = [
    {
      id: "offer_proof",
      label: "Offer proof",
      state: ledger?.offerProofStatus === "stored" ? "complete" : "review",
      detail: ledger?.offerProofStatus === "stored"
        ? "Offer proof was stored in the success-fee ledger."
        : "Offer proof was submitted and needs ledger confirmation.",
    },
    {
      id: "offer_attribution",
      label: "Offer attribution",
      state: adminReviewRequired ? "review" : "complete",
      detail: adminReviewRequired
        ? "Admin review remains open to verify the hire came through Hire.AI activity."
        : "Offer attribution is already confirmed for this report.",
    },
    {
      id: "verification",
      label: "Initial verification",
      state: ledger?.verificationStatus === "pending_review" ? "review" : "pending",
      detail: "Initial employment verification is pending review before the arrangement becomes fully current.",
    },
    {
      id: "billing",
      label: "Payment setup",
      state: paymentActionRequired ? "pending" : "complete",
      detail: paymentActionRequired
        ? "Continue in secure Stripe Checkout before recurring billing can start."
        : "Stripe subscription metadata was linked to the reported success fee.",
    },
  ];

  if (paymentActionRequired) {
    return {
      label: "Hire report recorded",
      nextAction: "Continue in secure Stripe Checkout, then watch the admin review and verification queues.",
      feeId,
      monthlyFeeCents,
      paymentActionRequired,
      adminReviewRequired,
      items,
    };
  }

  return {
    label: "Hire report recorded",
    nextAction: adminReviewRequired
      ? "Admin review is now open for attribution and proof verification."
      : "Keep quarterly verification and payment records current.",
    feeId,
    monthlyFeeCents,
    paymentActionRequired,
    adminReviewRequired,
    items,
  };
}
