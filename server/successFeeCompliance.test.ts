import { describe, expect, it } from "vitest";
import {
  getSuccessFeeComplianceQueue,
  getSuccessFeeComplianceSummary,
} from "./successFeeCompliance";
import type { SuccessFee } from "../drizzle/schema";

function fee(overrides: Partial<SuccessFee>): SuccessFee {
  return {
    id: 1,
    userId: 1,
    applicationId: null,
    employerName: "Example Co",
    jobTitle: "Engineer",
    monthlySalary: 10000,
    currency: "USD",
    feePercent: 5,
    monthlyFeeAmount: 50000,
    stripeSubscriptionId: null,
    stripePriceId: null,
    status: "active",
    startDate: new Date("2026-01-01T00:00:00.000Z"),
    endDate: null,
    nextVerificationDue: null,
    verificationGraceExpiry: null,
    offerLetterUrl: null,
    offerLetterKey: null,
    termsAcceptedAt: new Date("2026-01-01T00:00:00.000Z"),
    notes: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("success fee compliance", () => {
  it("classifies pending attribution and overdue verification as attention required", () => {
    const now = new Date("2026-06-30T12:00:00.000Z");
    const fees = [fee({ nextVerificationDue: new Date("2026-06-20T12:00:00.000Z") })];
    const offerReviews = [{
      approval: { id: 77, applicationId: 88, riskLevel: "high" },
      latestEmployerResponse: { summary: "Employer extended an offer." },
    }];

    const summary = getSuccessFeeComplianceSummary(fees, offerReviews, now);
    const queue = getSuccessFeeComplianceQueue(fees, offerReviews, now);

    expect(summary).toMatchObject({
      status: "needs_attention",
      activeFees: 1,
      overdueVerifications: 1,
      pendingOfferAttributions: 1,
    });
    expect(queue.map((item) => item.type)).toEqual(["verification_overdue", "offer_attribution"]);
    expect(queue[0]).toMatchObject({
      priority: "critical",
      successFeeId: 1,
      daysUntilDue: -10,
    });
  });

  it("surfaces due-soon verification without blocking clear accounts", () => {
    const now = new Date("2026-06-30T12:00:00.000Z");
    const fees = [fee({ nextVerificationDue: new Date("2026-07-05T12:00:00.000Z") })];

    const summary = getSuccessFeeComplianceSummary(fees, [], now);
    const queue = getSuccessFeeComplianceQueue(fees, [], now);

    expect(summary.status).toBe("due_soon");
    expect(summary.daysUntilNextVerification).toBe(5);
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      type: "verification_due_soon",
      priority: "high",
      daysUntilDue: 5,
    });
  });

  it("surfaces suspended fees as payment-recovery work", () => {
    const now = new Date("2026-06-30T12:00:00.000Z");
    const fees = [fee({ status: "suspended", monthlyFeeAmount: 25_000 })];

    const summary = getSuccessFeeComplianceSummary(fees, [], now);
    const queue = getSuccessFeeComplianceQueue(fees, [], now);

    expect(summary).toMatchObject({
      status: "needs_attention",
      activeFees: 0,
      suspendedFees: 1,
      nextAction: expect.stringContaining("suspended success-fee payment"),
    });
    expect(queue).toMatchObject([
      { type: "payment_suspended", priority: "high", successFeeId: 1 },
    ]);
  });

  it("surfaces disputed and paused fees as explicit review work", () => {
    const now = new Date("2026-06-30T12:00:00.000Z");
    const fees = [
      fee({ id: 2, status: "paused" }),
      fee({ id: 3, status: "disputed" }),
    ];

    const summary = getSuccessFeeComplianceSummary(fees, [], now);
    const queue = getSuccessFeeComplianceQueue(fees, [], now);

    expect(summary).toMatchObject({
      status: "needs_attention",
      pausedFees: 1,
      disputedFees: 1,
      nextAction: expect.stringContaining("disputed success-fee record"),
    });
    expect(queue.map((item) => item.type)).toEqual(["billing_disputed", "billing_paused"]);
    expect(queue[0]).toMatchObject({ priority: "critical", successFeeId: 3 });
  });
});
