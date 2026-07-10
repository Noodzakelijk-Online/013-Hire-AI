import { describe, expect, it } from "vitest";
import { getOfferOperatingSummary } from "./offerOperatingSummary";

describe("offer operating summary", () => {
  it("does not surface offer work before an offer exists", () => {
    const summary = getOfferOperatingSummary({ status: "interview" }, null, null);

    expect(summary.status).toBe("not_applicable");
    expect(summary.canReportHire).toBe(false);
  });

  it("prioritizes pending offer attribution review", () => {
    const summary = getOfferOperatingSummary(
      { status: "offer" },
      { approval: { status: "pending" } },
      null
    );

    expect(summary.status).toBe("attribution_review");
    expect(summary.canReportHire).toBe(true);
    expect(summary.hasOfferAttributionReview).toBe(true);
  });

  it("does not surface attribution or hire reporting for a non-offer application", () => {
    const summary = getOfferOperatingSummary(
      { status: "pending" },
      { approval: { status: "pending" } },
      null
    );

    expect(summary.status).toBe("not_applicable");
    expect(summary.canReportHire).toBe(false);
  });

  it("asks accepted offers without a fee to be reported", () => {
    const summary = getOfferOperatingSummary({ status: "accepted" }, null, null);

    expect(summary.status).toBe("report_hire");
    expect(summary.canReportHire).toBe(true);
  });

  it("tracks initial verification after a success fee is created", () => {
    const summary = getOfferOperatingSummary(
      { status: "offer" },
      null,
      {
        status: "pending_verification",
        monthlyFeeAmount: 25_000,
        nextVerificationDue: "2026-09-29T12:00:00.000Z",
      }
    );

    expect(summary.status).toBe("verification_pending");
    expect(summary.canReportHire).toBe(false);
    expect(summary.monthlyFeeCents).toBe(25_000);
    expect(summary.nextVerificationDue?.toISOString()).toBe("2026-09-29T12:00:00.000Z");
  });

  it("keeps active fees in verification upkeep mode", () => {
    const summary = getOfferOperatingSummary({ status: "accepted" }, null, { status: "active" });

    expect(summary.status).toBe("fee_active");
    expect(summary.label).toBe("Success fee active");
  });

  it("routes suspended or disputed fees to compliance review", () => {
    const summary = getOfferOperatingSummary({ status: "accepted" }, null, { status: "disputed" });

    expect(summary.status).toBe("fee_attention");
    expect(summary.canReportHire).toBe(false);
  });
});
