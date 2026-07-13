import { describe, expect, it } from "vitest";
import {
  getEmploymentEndCompletionSummary,
  getEmploymentEndControlSummary,
} from "./employmentEndControl";

describe("employment end control", () => {
  it("allows active fees to enter final obligation review", () => {
    const summary = getEmploymentEndControlSummary({
      status: "active",
      employerName: "LedgerWorks",
      jobTitle: "Remote Analyst",
      stripeSubscriptionId: "sub_123",
    }, "2026-07-15T00:00:00.000Z");

    expect(summary.canReport).toBe(true);
    expect(summary.label).toBe("Final obligation review");
    expect(summary.risk).toBe("high");
    expect(summary.detail).toContain("only after Stripe confirms cancellation");
    expect(summary.checkpoints).toEqual(expect.arrayContaining([
      "Linked Stripe subscription cancellation must be confirmed before the local fee ledger changes.",
      "Audit event and admin review item will be created for final billing and verification context.",
    ]));
  });

  it("blocks already closed fees from being reported again", () => {
    const summary = getEmploymentEndControlSummary({
      status: "ended",
    }, "2026-07-15T00:00:00.000Z");

    expect(summary.canReport).toBe(false);
    expect(summary.label).toBe("Not reportable");
  });

  it("summarizes the backend completion state for users", () => {
    const summary = getEmploymentEndCompletionSummary({
      success: true,
      status: "pending_admin_review",
      stripeSubscriptionCancelled: true,
      approvalId: 9901,
    });

    expect(summary.label).toBe("Closure recorded");
    expect(summary.headline).toContain("admin review");
    expect(summary.checkpoints).toEqual(expect.arrayContaining([
      { label: "Success-fee record moved to ended.", state: "complete" },
      { label: "Linked subscription cancellation completed.", state: "complete" },
      { label: "Billing approval and audit event were recorded.", state: "complete" },
      {
        label: "Admin review remains open for final billing and verification context.",
        state: "pending_review",
      },
    ]));
  });
});
