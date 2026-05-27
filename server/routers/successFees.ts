import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { successFees, employmentVerifications, feePayments, users } from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { storagePut } from "../storage";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const MIN_MONTHLY_SALARY = 300; // USD
const FEE_PERCENT = 5;

// Helper: get or create Stripe customer for user
async function getOrCreateStripeCustomer(userId: number, email: string, name: string | null) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  
  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email,
    name: name ?? undefined,
    metadata: { userId: userId.toString() },
  });

  await db.update(users).set({ stripeCustomerId: customer.id }).where(eq(users.id, userId));
  return customer.id;
}

// Helper: calculate monthly fee amount in cents
function calculateMonthlyFee(monthlySalary: number): number {
  return Math.round((monthlySalary * FEE_PERCENT) / 100 * 100); // in cents
}

export const successFeesRouter = router({
  // Report a new hire and set up success fee
  reportHire: protectedProcedure
    .input(z.object({
      employerName: z.string().min(1).max(255),
      jobTitle: z.string().min(1).max(255),
      monthlySalary: z.number().min(MIN_MONTHLY_SALARY, `Minimum salary is $${MIN_MONTHLY_SALARY}/month`),
      currency: z.string().default("USD"),
      startDate: z.string(), // ISO date string
      applicationId: z.number().optional(),
      offerLetterBase64: z.string().min(1, "Offer letter is required"),
      offerLetterMimeType: z.string().default("application/pdf"),
      offerLetterFileName: z.string().default("offer_letter.pdf"),
      termsAccepted: z.boolean().refine(v => v === true, "You must accept the terms"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const userId = ctx.user.id;

      // Check if user already has an active fee for this employer
      const existingFee = await db
        .select()
        .from(successFees)
        .where(
          and(
            eq(successFees.userId, userId),
            eq(successFees.employerName, input.employerName),
            eq(successFees.status, "active")
          )
        )
        .limit(1);

      if (existingFee.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You already have an active success fee for this employer.",
        });
      }

      // Upload offer letter to S3
      const fileBuffer = Buffer.from(input.offerLetterBase64, "base64");
      const fileKey = `offer-letters/${userId}-${Date.now()}-${input.offerLetterFileName}`;
      const { url: offerLetterUrl } = await storagePut(fileKey, fileBuffer, input.offerLetterMimeType);

      // Calculate fee
      const monthlyFeeAmount = calculateMonthlyFee(input.monthlySalary);
      const startDate = new Date(input.startDate);

      // Set next verification due date (90 days from start)
      const nextVerificationDue = new Date(startDate);
      nextVerificationDue.setDate(nextVerificationDue.getDate() + 90);

      // Create success fee record
      const [fee] = await db.insert(successFees).values({
        userId,
        applicationId: input.applicationId ?? null,
        employerName: input.employerName,
        jobTitle: input.jobTitle,
        monthlySalary: input.monthlySalary,
        currency: input.currency,
        feePercent: FEE_PERCENT,
        monthlyFeeAmount,
        status: "pending_verification",
        startDate,
        nextVerificationDue,
        offerLetterUrl,
        offerLetterKey: fileKey,
        termsAcceptedAt: new Date(),
      }).$returningId();

      // Create initial verification record
      await db.insert(employmentVerifications).values({
        successFeeId: fee.id,
        userId,
        verificationType: "initial",
        documentUrl: offerLetterUrl,
        documentKey: fileKey,
        documentType: "offer_letter",
        status: "pending",
        submittedAt: new Date(),
      });

      // Get or create Stripe customer
      const stripeCustomerId = await getOrCreateStripeCustomer(
        userId,
        ctx.user.email ?? "",
        ctx.user.name
      );

      // Create a Stripe product and price for this specific fee
      const product = await stripe.products.create({
        name: `Hire.AI Success Fee - ${input.employerName}`,
        metadata: {
          userId: userId.toString(),
          successFeeId: fee.id.toString(),
          employerName: input.employerName,
        },
      });

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: monthlyFeeAmount,
        currency: input.currency.toLowerCase(),
        recurring: { interval: "month" },
        metadata: {
          successFeeId: fee.id.toString(),
        },
      });

      // Create Stripe subscription
      const subscription = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: price.id }],
        metadata: {
          userId: userId.toString(),
          successFeeId: fee.id.toString(),
          employerName: input.employerName,
        },
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.payment_intent"],
      });

      // Update fee with Stripe subscription ID
      await db.update(successFees)
        .set({
          stripeSubscriptionId: subscription.id,
          stripePriceId: price.id,
        })
        .where(eq(successFees.id, fee.id));

      const invoice = subscription.latest_invoice as Stripe.Invoice & { payment_intent?: Stripe.PaymentIntent };
      const paymentIntent = invoice?.payment_intent as Stripe.PaymentIntent | undefined;

      return {
        feeId: fee.id,
        monthlyFeeAmount,
        stripeSubscriptionId: subscription.id,
        clientSecret: paymentIntent?.client_secret,
        subscriptionStatus: subscription.status,
      };
    }),

  // Get user's success fees
  getMyFees: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const fees = await db
      .select()
      .from(successFees)
      .where(eq(successFees.userId, ctx.user.id))
      .orderBy(desc(successFees.createdAt));

    return fees;
  }),

  // Get fee payments history
  getPaymentHistory: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const payments = await db
      .select()
      .from(feePayments)
      .where(eq(feePayments.userId, ctx.user.id))
      .orderBy(desc(feePayments.createdAt));

    return payments;
  }),

  // Submit quarterly verification document
  submitVerification: protectedProcedure
    .input(z.object({
      successFeeId: z.number(),
      documentBase64: z.string().min(1),
      documentMimeType: z.string().default("application/pdf"),
      documentFileName: z.string().default("verification.pdf"),
      documentType: z.enum(["paystub", "employment_letter", "bank_statement", "other"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const userId = ctx.user.id;

      // Verify the fee belongs to this user
      const [fee] = await db
        .select()
        .from(successFees)
        .where(and(eq(successFees.id, input.successFeeId), eq(successFees.userId, userId)))
        .limit(1);

      if (!fee) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Success fee not found." });
      }

      // Upload document
      const fileBuffer = Buffer.from(input.documentBase64, "base64");
      const fileKey = `verifications/${userId}-${Date.now()}-${input.documentFileName}`;
      const { url: documentUrl } = await storagePut(fileKey, fileBuffer, input.documentMimeType);

      // Create verification record
      await db.insert(employmentVerifications).values({
        successFeeId: input.successFeeId,
        userId,
        verificationType: "quarterly",
        documentUrl,
        documentKey: fileKey,
        documentType: input.documentType,
        status: "pending",
        submittedAt: new Date(),
      });

      // Update next verification due date (90 days from now)
      const nextDue = new Date();
      nextDue.setDate(nextDue.getDate() + 90);
      const graceExpiry = new Date(nextDue);
      graceExpiry.setDate(graceExpiry.getDate() + 14);

      await db.update(successFees)
        .set({ nextVerificationDue: nextDue, verificationGraceExpiry: graceExpiry })
        .where(eq(successFees.id, input.successFeeId));

      return { success: true };
    }),

  // Report employment ended (user left job)
  reportEmploymentEnded: protectedProcedure
    .input(z.object({
      successFeeId: z.number(),
      endDate: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const userId = ctx.user.id;

      const [fee] = await db
        .select()
        .from(successFees)
        .where(and(eq(successFees.id, input.successFeeId), eq(successFees.userId, userId)))
        .limit(1);

      if (!fee) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Success fee not found." });
      }

      // Cancel Stripe subscription
      if (fee.stripeSubscriptionId) {
        await stripe.subscriptions.cancel(fee.stripeSubscriptionId);
      }

      // Update fee status
      await db.update(successFees)
        .set({ status: "ended", endDate: new Date(input.endDate) })
        .where(eq(successFees.id, input.successFeeId));

      return { success: true };
    }),

  // Get verifications for a fee
  getFeeVerifications: protectedProcedure
    .input(z.object({ successFeeId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const verifications = await db
        .select()
        .from(employmentVerifications)
        .where(
          and(
            eq(employmentVerifications.successFeeId, input.successFeeId),
            eq(employmentVerifications.userId, ctx.user.id)
          )
        )
        .orderBy(desc(employmentVerifications.submittedAt));

      return verifications;
    }),

  // Get Stripe billing portal URL
  getBillingPortalUrl: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);

    if (!user.stripeCustomerId) {
      throw new TRPCError({ code: "NOT_FOUND", message: "No billing account found." });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.VITE_FRONTEND_FORGE_API_URL ?? "http://localhost:3000"}/billing`,
    });

    return { url: session.url };
  }),
});
