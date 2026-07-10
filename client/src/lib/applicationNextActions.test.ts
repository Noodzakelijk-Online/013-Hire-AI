import { describe, expect, it } from "vitest";
import { getApplicationNextActions } from "./applicationNextActions";
import type { ApplicationLedgerSummary } from "./applicationLedgerSummary";

const baseLedger: ApplicationLedgerSummary = {
  status: "in_progress",
  label: "In progress",
  nextAction: "Continue tracking.",
  hasPreparedMaterial: true,
  hasSubmissionEvidence: true,
  hasEmployerResponse: false,
  pendingApproval: false,
  approvedSubmission: false,
  rejectedSubmission: false,
  openFollowUpDrafts: 0,
  sentFollowUpsAwaitingResponse: 0,
  staleFollowUpCancellations: 0,
  staleFollowUpCancellationReason: null,
  auditEventCount: 0,
};

describe("getApplicationNextActions", () => {
  it("routes pending submission approvals to the review queue", () => {
    const summary = getApplicationNextActions({
      application: { status: "pending" },
      ledgerSummary: {
        ...baseLedger,
        status: "approval_blocked",
        pendingApproval: true,
      },
    });

    expect(summary.primary.id).toBe("review_queue");
    expect(summary.primary.requiresApproval).toBe(true);
    expect(summary.attentionCount).toBe(1);
  });

  it("requires deterministic evidence after submission approval", () => {
    const summary = getApplicationNextActions({
      application: { status: "pending" },
      ledgerSummary: {
        ...baseLedger,
        status: "evidence_required",
        approvedSubmission: true,
        hasSubmissionEvidence: false,
      },
    });

    expect(summary.primary.id).toBe("confirm_submission");
    expect(summary.primary.risk).toBe("high");
  });

  it("routes approved pending submissions to evidence resolution before confirmation when gates are active", () => {
    const summary = getApplicationNextActions({
      application: { status: "pending" },
      evidenceGateCount: 2,
      ledgerSummary: {
        ...baseLedger,
        status: "evidence_required",
        approvedSubmission: true,
        hasSubmissionEvidence: false,
      },
    });

    expect(summary.primary.id).toBe("resolve_evidence");
    expect(summary.primary.requiresApproval).toBe(false);
    expect(summary.secondary.some((action) => action.id === "confirm_submission")).toBe(true);
  });

  it("prioritizes interview scheduling after an invite", () => {
    const summary = getApplicationNextActions({
      application: { status: "interview" },
      ledgerSummary: baseLedger,
      interviewSummary: {
        status: "needs_scheduling",
        label: "Schedule interview",
        nextAction: "Capture interview details.",
        canSchedule: true,
        activeInterviews: 0,
        completedInterviews: 0,
        cancelledInterviews: 0,
        nextInterviewAt: null,
      },
    });

    expect(summary.primary.id).toBe("schedule_interview");
    expect(summary.secondary.some((action) => action.id === "record_response")).toBe(true);
  });

  it("keeps follow-up drafting approval-gated", () => {
    const summary = getApplicationNextActions({
      application: { status: "applied" },
      canGenerateFollowUp: true,
      ledgerSummary: {
        ...baseLedger,
        status: "follow_up_due",
        hasEmployerResponse: false,
        sentFollowUpsAwaitingResponse: 0,
      },
    });

    expect(summary.primary.id).toBe("draft_follow_up");
    expect(summary.primary.requiresApproval).toBe(true);
  });

  it("keeps internal follow-up drafting available while evidence gates block external sending", () => {
    const summary = getApplicationNextActions({
      application: { status: "applied" },
      canGenerateFollowUp: true,
      evidenceGateCount: 1,
      ledgerSummary: {
        ...baseLedger,
        status: "follow_up_due",
        hasEmployerResponse: false,
        sentFollowUpsAwaitingResponse: 0,
      },
    });

    expect(summary.primary.id).toBe("draft_follow_up");
    expect(summary.secondary.some((action) => action.id === "resolve_evidence")).toBe(true);
  });

  it("routes offer attribution before report-hire actions", () => {
    const summary = getApplicationNextActions({
      application: { status: "offer" },
      ledgerSummary: {
        ...baseLedger,
        status: "offer_action",
      },
      offerSummary: {
        status: "attribution_review",
        label: "Offer attribution",
        nextAction: "Review attribution.",
        canReportHire: true,
        hasOfferAttributionReview: true,
        hasSuccessFee: false,
        monthlyFeeCents: 0,
        nextVerificationDue: null,
      },
    });

    expect(summary.primary.id).toBe("review_queue");
    expect(summary.secondary.some((action) => action.id === "report_hire")).toBe(true);
  });

  it("requires explicit acceptance before advancing an unconfirmed offer", () => {
    const summary = getApplicationNextActions({
      application: { status: "offer" },
      ledgerSummary: {
        ...baseLedger,
        status: "offer_action",
      },
      offerSummary: {
        status: "report_hire",
        label: "Report hire",
        nextAction: "Report the hire.",
        canReportHire: true,
        hasOfferAttributionReview: false,
        hasSuccessFee: false,
        monthlyFeeCents: 0,
        nextVerificationDue: null,
      },
    });

    expect(summary.primary.id).toBe("confirm_offer_acceptance");
    expect(summary.primary.risk).toBe("high");
    expect(summary.primary.requiresApproval).toBe(true);
    expect(summary.secondary.some((action) => action.id === "report_hire")).toBe(true);
  });

  it("falls back to the audit trail for closed applications", () => {
    const summary = getApplicationNextActions({
      application: { status: "withdrawn" },
      ledgerSummary: {
        ...baseLedger,
        status: "closed",
        auditEventCount: 3,
      },
    });

    expect(summary.primary.id).toBe("view_audit");
    expect(summary.secondary).toHaveLength(0);
  });
});
