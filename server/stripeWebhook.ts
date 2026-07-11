import express, { type Express } from "express";
import Stripe from "stripe";
import { createAuditEvent, getDb } from "./db";
import { successFees, feePayments } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { getStripeClient } from "./stripeClient";
import { claimStripeWebhookEvent, completeStripeWebhookEvent, failStripeWebhookEvent } from "./stripeWebhookLedger";
import { canTransitionSuccessFeeStatus } from "./successFeeStateMachine";

export function registerStripeWebhook(app: Express) {
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const sig = req.headers["stripe-signature"] as string;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      let event: Stripe.Event;

      try {
        if (webhookSecret && sig) {
          event = getStripeClient().webhooks.constructEvent(req.body, sig, webhookSecret);
        } else {
          // For development without webhook secret
          event = JSON.parse(req.body.toString()) as Stripe.Event;
        }
      } catch (err) {
        console.error("[Stripe Webhook] Signature verification failed:", err);
        res.status(400).send(`Webhook Error: ${(err as Error).message}`);
        return;
      }

      // Handle test events
      if (event.id.startsWith("evt_test_")) {
        console.log("[Stripe Webhook] Test event detected, returning verification response");
        res.json({ verified: true });
        return;
      }

      console.log(`[Stripe Webhook] Received event: ${event.type} (${event.id})`);

      const db = await getDb();
      if (!db) {
        console.error("[Stripe Webhook] Database unavailable");
        res.status(500).json({ error: "Database unavailable" });
        return;
      }

      const claim = await claimStripeWebhookEvent(event.id, event.type);
      if (!claim.claimed) {
        res.json({ received: true, duplicate: true });
        return;
      }

      try {
        switch (event.type) {
          case "invoice.paid": {
            const invoice = event.data.object as Stripe.Invoice & { subscription?: string };
            const subscriptionId = invoice.subscription as string;
            if (!subscriptionId) break;

            // Find the success fee for this subscription
            const [fee] = await db
              .select()
              .from(successFees)
              .where(eq(successFees.stripeSubscriptionId, subscriptionId))
              .limit(1);

            if (!fee) break;

            // Record payment
            await db.insert(feePayments).values({
              successFeeId: fee.id,
              userId: fee.userId,
              amount: invoice.amount_paid,
              currency: invoice.currency.toUpperCase(),
              stripeInvoiceId: invoice.id,
              status: "paid",
              paidAt: new Date(invoice.status_transitions.paid_at! * 1000),
              periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
              periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
            });

            // Activate fee if it was pending
            if (fee.status !== "active" && canTransitionSuccessFeeStatus(fee.status, "active")) {
              await db.update(successFees)
                .set({ status: "active" })
                .where(eq(successFees.id, fee.id));
              await createAuditEvent({
                userId: fee.userId,
                entityType: "success_fee",
                entityId: fee.id,
                action: "success_fee_activated_from_stripe_payment",
                actor: "system",
                source: `stripe:${event.type}`,
                beforeState: JSON.stringify({ status: fee.status }),
                afterState: JSON.stringify({ status: "active", stripeEventId: event.id }),
                riskLevel: "high",
              });
            }

            await createAuditEvent({
              userId: fee.userId,
              entityType: "success_fee",
              entityId: fee.id,
              action: "stripe_payment_recorded",
              actor: "system",
              source: `stripe:${event.type}`,
              afterState: JSON.stringify({ stripeEventId: event.id, stripeInvoiceId: invoice.id, status: "paid" }),
              riskLevel: "high",
            });

            console.log(`[Stripe Webhook] Payment recorded for fee ${fee.id}: ${invoice.amount_paid} ${invoice.currency}`);
            break;
          }

          case "invoice.payment_failed": {
            const invoice = event.data.object as Stripe.Invoice & { subscription?: string };
            const subscriptionId = invoice.subscription as string;
            if (!subscriptionId) break;

            const [fee] = await db
              .select()
              .from(successFees)
              .where(eq(successFees.stripeSubscriptionId, subscriptionId))
              .limit(1);

            if (!fee) break;

            // Record failed payment
            await db.insert(feePayments).values({
              successFeeId: fee.id,
              userId: fee.userId,
              amount: invoice.amount_due,
              currency: invoice.currency.toUpperCase(),
              stripeInvoiceId: invoice.id,
              status: "failed",
              periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
              periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
            });

            if (fee.status !== "suspended" && canTransitionSuccessFeeStatus(fee.status, "suspended")) {
              await db.update(successFees)
                .set({ status: "suspended" })
                .where(eq(successFees.id, fee.id));
            }
            await createAuditEvent({
              userId: fee.userId,
              entityType: "success_fee",
              entityId: fee.id,
              action: "stripe_payment_failed",
              actor: "system",
              source: `stripe:${event.type}`,
              beforeState: JSON.stringify({ status: fee.status }),
              afterState: JSON.stringify({ status: "suspended", stripeEventId: event.id, stripeInvoiceId: invoice.id }),
              riskLevel: "high",
            });

            console.log(`[Stripe Webhook] Payment failed for fee ${fee.id}`);
            break;
          }

          case "customer.subscription.deleted": {
            const subscription = event.data.object as Stripe.Subscription;

            const [fee] = await db
              .select()
              .from(successFees)
              .where(eq(successFees.stripeSubscriptionId, subscription.id))
              .limit(1);

            if (!fee) break;

            if (fee.status !== "ended" && canTransitionSuccessFeeStatus(fee.status, "ended")) {
              await db.update(successFees)
                .set({ status: "ended", endDate: new Date() })
                .where(eq(successFees.id, fee.id));
              await createAuditEvent({
                userId: fee.userId,
                entityType: "success_fee",
                entityId: fee.id,
                action: "stripe_subscription_ended",
                actor: "system",
                source: `stripe:${event.type}`,
                beforeState: JSON.stringify({ status: fee.status }),
                afterState: JSON.stringify({ status: "ended", stripeEventId: event.id }),
                riskLevel: "high",
              });
            }

            console.log(`[Stripe Webhook] Subscription cancelled for fee ${fee.id}`);
            break;
          }

          case "customer.subscription.updated": {
            const subscription = event.data.object as Stripe.Subscription;

            const [fee] = await db
              .select()
              .from(successFees)
              .where(eq(successFees.stripeSubscriptionId, subscription.id))
              .limit(1);

            if (!fee) break;

            // Handle subscription status changes
            if (subscription.status === "active" && fee.status !== "active" && canTransitionSuccessFeeStatus(fee.status, "active")) {
              await db.update(successFees)
                .set({ status: "active" })
                .where(eq(successFees.id, fee.id));
            } else if (subscription.status === "past_due" && fee.status !== "suspended" && canTransitionSuccessFeeStatus(fee.status, "suspended")) {
              await db.update(successFees)
                .set({ status: "suspended" })
                .where(eq(successFees.id, fee.id));
            }
            break;
          }

          default:
            console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
        }

        await completeStripeWebhookEvent(event.id);
        res.json({ received: true });
      } catch (err) {
        await failStripeWebhookEvent(event.id, err);
        console.error("[Stripe Webhook] Error processing event:", err);
        res.status(500).json({ error: "Webhook processing failed" });
      }
    }
  );
}
