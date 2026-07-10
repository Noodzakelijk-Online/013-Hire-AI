import { describe, expect, it } from "vitest";
import { getReportHireCompletionSummary, getReportHireEvidenceSummary } from "./reportHireEvidence";

describe("report hire evidence summary", () => {
  it("marks a linked offer with proof and terms ready to report", () => {
    const summary = getReportHireEvidenceSummary({
      application: { id: 10, status: "offer", job: { title: "Engineer", company: "Acme" } },
      attributionReview: {
        approval: { id: 50, status: "pending", riskLevel: "high" },
        latestEmployerResponse: { summary: "Employer sent a written offer." },
      },
      hasOfferLetter: true,
      termsAccepted: true,
    });

    expect(summary.status).toBe("ready");
    expect(summary.canConfirm).toBe(true);
    expect(summary.risk).toBe("high");
    expect(summary.checkpoints.find((checkpoint) => checkpoint.id === "offer_response")?.state).toBe("complete");
  });

  it("blocks terms progress until offer proof is selected", () => {
    const summary = getReportHireEvidenceSummary({
      application: { id: 11, status: "accepted" },
      hasOfferLetter: false,
      termsAccepted: false,
    });

    expect(summary.status).toBe("needs_proof");
    expect(summary.canContinueToTerms).toBe(false);
    expect(summary.canConfirm).toBe(false);
  });

  it("requires explicit terms before confirmation", () => {
    const summary = getReportHireEvidenceSummary({
      application: { id: 12, status: "accepted" },
      hasOfferLetter: true,
      termsAccepted: false,
    });

    expect(summary.status).toBe("needs_terms");
    expect(summary.canContinueToTerms).toBe(true);
    expect(summary.canConfirm).toBe(false);
  });

  it("blocks a linked pending application before proof or terms can advance", () => {
    const summary = getReportHireEvidenceSummary({
      application: { id: 13, status: "pending" },
      hasOfferLetter: true,
      termsAccepted: true,
    });

    expect(summary.status).toBe("application_not_offer");
    expect(summary.canContinueToTerms).toBe(false);
    expect(summary.canConfirm).toBe(false);
  });

  it("keeps unlinked hires approval-gated and critical risk", () => {
    const summary = getReportHireEvidenceSummary({
      application: null,
      hasOfferLetter: true,
      termsAccepted: true,
    });

    expect(summary.status).toBe("unlinked_review");
    expect(summary.risk).toBe("critical");
    expect(summary.canConfirm).toBe(true);
    expect(summary.checkpoints.find((checkpoint) => checkpoint.id === "application_link")?.state).toBe("review");
  });

  it("summarizes the recorded hire ledger state after payment setup starts", () => {
    const summary = getReportHireCompletionSummary({
      feeId: 42,
      monthlyFeeAmount: 25_000,
      subscriptionStatus: "incomplete",
      clientSecret: "pi_secret",
      ledger: {
        offerProofStatus: "stored",
        offerAttributionStatus: "admin_review_open",
        verificationStatus: "pending_review",
        billingSetupStatus: "payment_setup_required",
        adminReviewRequired: true,
      },
    });

    expect(summary.label).toBe("Hire report recorded");
    expect(summary.paymentActionRequired).toBe(true);
    expect(summary.adminReviewRequired).toBe(true);
    expect(summary.monthlyFeeCents).toBe(25_000);
    expect(summary.items.find((item) => item.id === "offer_proof")?.state).toBe("complete");
    expect(summary.items.find((item) => item.id === "billing")?.state).toBe("pending");
  });

  it("does not overstate payment action when no payment secret is returned", () => {
    const summary = getReportHireCompletionSummary({
      feeId: 43,
      monthlyFeeAmount: 15_000,
      subscriptionStatus: "active",
      ledger: {
        offerProofStatus: "stored",
        offerAttributionStatus: "confirmed",
        verificationStatus: "pending_review",
        billingSetupStatus: "subscription_created",
        adminReviewRequired: false,
      },
    });

    expect(summary.paymentActionRequired).toBe(false);
    expect(summary.adminReviewRequired).toBe(false);
    expect(summary.nextAction).toContain("quarterly verification");
    expect(summary.items.find((item) => item.id === "offer_attribution")?.state).toBe("complete");
  });
});
