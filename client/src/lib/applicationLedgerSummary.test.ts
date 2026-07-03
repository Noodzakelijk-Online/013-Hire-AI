import { describe, expect, it } from "vitest";
import { getApplicationLedgerSummary } from "./applicationLedgerSummary";

describe("application ledger summary", () => {
  it("blocks pending applications on unresolved submission approval", () => {
    const summary = getApplicationLedgerSummary(
      { status: "pending" },
      { material: {}, attempts: [], employerResponses: [], auditEvents: [] },
      { status: "pending" }
    );

    expect(summary.status).toBe("approval_blocked");
    expect(summary.pendingApproval).toBe(true);
    expect(summary.nextAction).toContain("Approve or reject");
  });

  it("requires deterministic evidence after submission approval", () => {
    const summary = getApplicationLedgerSummary(
      { status: "pending" },
      { material: {}, attempts: [{ status: "prepared" }], employerResponses: [], auditEvents: [] },
      { status: "approved" }
    );

    expect(summary.status).toBe("evidence_required");
    expect(summary.approvedSubmission).toBe(true);
    expect(summary.hasSubmissionEvidence).toBe(false);
  });

  it("recognizes submitted evidence and audit history", () => {
    const summary = getApplicationLedgerSummary(
      { status: "pending" },
      {
        material: {},
        attempts: [{ status: "submitted", confirmationText: "ATS confirmed submission #ABC" }],
        employerResponses: [],
        auditEvents: [{ id: 1 }],
      },
      { status: "approved" }
    );

    expect(summary.status).toBe("in_progress");
    expect(summary.hasSubmissionEvidence).toBe(true);
    expect(summary.auditEventCount).toBe(1);
  });

  it("prioritizes employer responses over follow-up prompts", () => {
    const summary = getApplicationLedgerSummary(
      { status: "applied" },
      {
        material: {},
        attempts: [{ status: "submitted", confirmationUrl: "https://example.com/confirmation" }],
        employerResponses: [{ responseType: "interview_invite" }],
        auditEvents: [],
      },
      { status: "approved" },
      []
    );

    expect(summary.status).toBe("response_received");
    expect(summary.hasEmployerResponse).toBe(true);
  });

  it("surfaces follow-up drafts as approval work", () => {
    const summary = getApplicationLedgerSummary(
      { status: "applied" },
      { material: {}, attempts: [], employerResponses: [], auditEvents: [] },
      null,
      [{ sentDate: null }]
    );

    expect(summary.status).toBe("follow_up_review");
    expect(summary.openFollowUpDrafts).toBe(1);
  });

  it("summarizes stale follow-up approvals retired by employer responses", () => {
    const summary = getApplicationLedgerSummary(
      { status: "interview" },
      {
        material: {},
        attempts: [{ status: "submitted", confirmationText: "ATS confirmation stored." }],
        employerResponses: [{ responseType: "interview_invite" }],
        auditEvents: [{
          action: "stale_follow_up_approvals_cancelled",
          afterState: JSON.stringify({
            responseType: "interview_invite",
            cancelledApprovalIds: [41],
          }),
        }],
      },
      { status: "approved" },
      []
    );

    expect(summary.staleFollowUpCancellations).toBe(1);
    expect(summary.staleFollowUpCancellationReason).toContain("interview invite");
    expect(summary.staleFollowUpCancellationReason).toContain("retired");
  });
});
