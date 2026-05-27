import express, { type Express } from "express";
import Stripe from "stripe";
import { getDb } from "./db";
import { successFees, feePayments } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

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
          event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
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
            if (fee.status === "pending_verification") {
              await db.update(successFees)
                .set({ status: "active" })
                .where(eq(successFees.id, fee.id));
            }

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

            await db.update(successFees)
              .set({ status: "ended", endDate: new Date() })
              .where(eq(successFees.id, fee.id));

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
            if (subscription.status === "active" && fee.status === "pending_verification") {
              await db.update(successFees)
                .set({ status: "active" })
                .where(eq(successFees.id, fee.id));
            } else if (subscription.status === "past_due") {
              await db.update(successFees)
                .set({ status: "suspended" })
                .where(eq(successFees.id, fee.id));
            }
            break;
          }

          default:
            console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
        }

        res.json({ received: true });
      } catch (err) {
        console.error("[Stripe Webhook] Error processing event:", err);
        res.status(500).json({ error: "Webhook processing failed" });
      }
    }
  );
}
