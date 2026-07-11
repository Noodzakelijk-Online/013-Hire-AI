import { beforeEach, describe, expect, it } from "vitest";
import {
  claimStripeWebhookEvent,
  clearStripeWebhookLedgerForTests,
  completeStripeWebhookEvent,
  failStripeWebhookEvent,
} from "./stripeWebhookLedger";

describe("Stripe webhook event ledger", () => {
  beforeEach(() => clearStripeWebhookLedgerForTests());

  it("claims an event once and ignores duplicate delivery after completion", async () => {
    expect(await claimStripeWebhookEvent("evt_ledger_1", "invoice.paid")).toMatchObject({ claimed: true });
    await completeStripeWebhookEvent("evt_ledger_1");
    expect(await claimStripeWebhookEvent("evt_ledger_1", "invoice.paid")).toMatchObject({ claimed: false, duplicate: true });
  });

  it("allows a failed event to be retried", async () => {
    await claimStripeWebhookEvent("evt_ledger_2", "invoice.payment_failed");
    await failStripeWebhookEvent("evt_ledger_2", new Error("temporary outage"));
    expect(await claimStripeWebhookEvent("evt_ledger_2", "invoice.payment_failed")).toMatchObject({ claimed: true });
  });
});
