import { describe, expect, it } from "vitest";
import { getSuccessFeeComplianceAction, getSuccessFeeComplianceSummary } from "./successFeeCompliance";

describe("success fee compliance summary", () => {
  const now = new Date("2026-06-29T12:00:00.000Z");

  it("flags pending offer attribution before billing setup", () => {
    const summary = getSuccessFeeComplianceSummary([], [{ approval: { id: 1 } }], now);

    expect(summary.status).toBe("needs_attention");
    expect(summary.pendingOfferAttributions).toBe(1);
    expect(summary.nextAction).toContain("Review offer attribution");
    expect(getSuccessFeeComplianceAction(summary)).toMatchObject({
      id: "review_offer_attribution",
      route: "/review-queue",
      risk: "high",
      proofRequired: true,
      approvalGated: true,
    });
  });

  it("flags overdue verification deadlines", () => {
    const summary = getSuccessFeeComplianceSummary(
      [{
        status: "active",
        monthlyFeeAmount: 25_000,
        nextVerificationDue: "2026-06-20T12:00:00.000Z",
      }],
      [],
      now
    );

    expect(summary.status).toBe("needs_attention");
    expect(summary.overdueVerifications).toBe(1);
    expect(summary.monthlyFeeCents).toBe(25_000);
    expect(getSuccessFeeComplianceAction(summary)).toMatchObject({
      id: "submit_verification",
      risk: "critical",
      proofRequired: true,
    });
  });

  it("marks verification due soon before it is overdue", () => {
    const summary = getSuccessFeeComplianceSummary(
      [{
        status: "active",
        nextVerificationDue: "2026-07-05T12:00:00.000Z",
      }],
      [],
      now
    );

    expect(summary.status).toBe("due_soon");
    expect(summary.dueSoonVerifications).toBe(1);
    expect(summary.daysUntilNextVerification).toBe(6);
    expect(getSuccessFeeComplianceAction(summary)).toMatchObject({
      id: "prepare_verification",
      risk: "medium",
      approvalGated: false,
    });
  });

  it("routes suspended billing to payment recovery instead of report-hire", () => {
    const summary = getSuccessFeeComplianceSummary(
      [{ status: "suspended", monthlyFeeAmount: 10_000 }],
      [],
      now
    );

    expect(summary).toMatchObject({
      status: "needs_attention",
      activeFees: 0,
      suspendedFees: 1,
    });
    expect(getSuccessFeeComplianceAction(summary)).toMatchObject({
      id: "resolve_suspended_payment",
      route: "/billing",
      risk: "high",
      approvalGated: false,
    });
  });

  it("reports clear state for active fees without pending work", () => {
    const summary = getSuccessFeeComplianceSummary(
      [{
        status: "active",
        monthlyFeeAmount: 10_000,
        nextVerificationDue: "2026-08-29T12:00:00.000Z",
      }],
      [],
      now
    );

    expect(summary.status).toBe("clear");
    expect(summary.activeFees).toBe(1);
    expect(summary.monthlyFeeCents).toBe(10_000);
    expect(getSuccessFeeComplianceAction(summary)).toMatchObject({
      id: "monitor",
      risk: "low",
      proofRequired: false,
    });
  });

  it("routes accounts with no active fees to the report-hire path", () => {
    const summary = getSuccessFeeComplianceSummary([], [], now);

    expect(summary.status).toBe("none");
    expect(getSuccessFeeComplianceAction(summary)).toMatchObject({
      id: "report_hire",
      risk: "high",
      proofRequired: true,
      approvalGated: true,
    });
  });
});
