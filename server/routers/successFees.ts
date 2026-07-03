import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { createAdminReviewItem, createAuditEvent, getDb, getUserOfferAttributionReviews, getUserSuccessFees } from "../db";
import { applicationApprovals, successFees, employmentVerifications, feePayments, users } from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { storagePut } from "../storage";
import { validateUploadedFile, VERIFICATION_MIME_TYPES } from "../uploadValidation";
import Stripe from "stripe";
import { getStripeClient } from "../stripeClient";
import { calculateNextVerificationDue } from "../successFeeDates";

const MIN_MONTHLY_SALARY = 300; // USD
const FEE_PERCENT = 5;

// Helper: get or create Stripe customer for user
async function getOrCreateStripeCustomer(userId: number, email: string, name: string | null) {
  const stripe = getStripeClient();
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
      const stripe = getStripeClient();
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
      const validation = validateUploadedFile({
        data: fileBuffer,
        fileName: input.offerLetterFileName,
        mimeType: input.offerLetterMimeType,
        allowedMimeTypes: VERIFICATION_MIME_TYPES,
      });
      const fileKey = `offer-letters/${userId}-${Date.now()}-${validation.fileName}`;
      const { url: offerLetterUrl } = await storagePut(fileKey, fileBuffer, input.offerLetterMimeType);

      // Calculate fee
      const monthlyFeeAmount = calculateMonthlyFee(input.monthlySalary);
      const startDate = new Date(input.startDate);

      // Set next verification due date (90 UTC days from start)
      const nextVerificationDue = calculateNextVerificationDue(startDate);

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

      const approvalDecidedAt = new Date();
      let offerAttributionApprovalId: number;
      if (input.applicationId) {
        const existingOfferApproval = await db
          .select({ id: applicationApprovals.id, status: applicationApprovals.status })
          .from(applicationApprovals)
          .where(and(
            eq(applicationApprovals.userId, userId),
            eq(applicationApprovals.entityType, "application"),
            eq(applicationApprovals.entityId, input.applicationId),
            eq(applicationApprovals.approvalType, "offer_attribution")
          ))
          .orderBy(desc(applicationApprovals.createdAt))
          .limit(1);
        if (existingOfferApproval[0]?.status === "rejected" || existingOfferApproval[0]?.status === "cancelled") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Offer attribution approval was rejected or cancelled for this application.",
          });
        }
        if (existingOfferApproval[0]) {
          offerAttributionApprovalId = existingOfferApproval[0].id;
          if (existingOfferApproval[0].status === "pending") {
            await db
              .update(applicationApprovals)
              .set({
                status: "approved",
                decidedBy: "user",
                decisionNote: "Approved through report-hire success fee flow.",
                decidedAt: approvalDecidedAt,
              })
              .where(eq(applicationApprovals.id, existingOfferApproval[0].id));
          }
        } else {
          const attributionApproval = await db.insert(applicationApprovals).values({
            userId,
            applicationId: input.applicationId,
            entityType: "application",
            entityId: input.applicationId,
            approvalType: "offer_attribution",
            status: "approved",
            riskLevel: "high",
            requestedBy: "user",
            decidedBy: "user",
            title: "Offer attribution confirmed",
            description: `User reported hire at ${input.employerName} for ${input.jobTitle}.`,
            payload: JSON.stringify({
              successFeeId: fee.id,
              employerName: input.employerName,
              jobTitle: input.jobTitle,
              monthlySalary: input.monthlySalary,
            }),
            decisionNote: "Approved through report-hire success fee flow.",
            requestedAt: approvalDecidedAt,
            decidedAt: approvalDecidedAt,
          });
          offerAttributionApprovalId = Number(attributionApproval[0].insertId);
        }
      } else {
        const attributionApproval = await db.insert(applicationApprovals).values({
          userId,
          applicationId: null,
          entityType: "success_fee",
          entityId: fee.id,
          approvalType: "offer_attribution",
          status: "approved",
          riskLevel: "high",
          requestedBy: "user",
          decidedBy: "user",
          title: "Offer attribution reported without linked application",
          description: `User reported hire at ${input.employerName} for ${input.jobTitle}.`,
          payload: JSON.stringify({
            successFeeId: fee.id,
            employerName: input.employerName,
            jobTitle: input.jobTitle,
            monthlySalary: input.monthlySalary,
          }),
          decisionNote: "User reported hire without an application link.",
          requestedAt: approvalDecidedAt,
          decidedAt: approvalDecidedAt,
        });
        offerAttributionApprovalId = Number(attributionApproval[0].insertId);
      }

      const billingApproval = await db.insert(applicationApprovals).values({
        userId,
        applicationId: input.applicationId ?? null,
        entityType: "billing",
        entityId: fee.id,
        approvalType: "billing_action",
        status: "approved",
        riskLevel: "critical",
        requestedBy: "user",
        decidedBy: "user",
        title: "Success fee subscription setup approved",
        description: `User accepted success-fee terms for ${input.employerName}.`,
        payload: JSON.stringify({
          successFeeId: fee.id,
          employerName: input.employerName,
          monthlyFeeAmount,
          feePercent: FEE_PERCENT,
        }),
        decisionNote: "User accepted success-fee terms before Stripe subscription setup.",
        requestedAt: approvalDecidedAt,
        decidedAt: approvalDecidedAt,
      });
      const billingApprovalId = Number(billingApproval[0].insertId);

      await createAuditEvent({
        userId,
        entityType: "success_fee",
        entityId: fee.id,
        action: "hire_reported",
        actor: "user",
        source: "successFees.reportHire",
        afterState: JSON.stringify({
          applicationId: input.applicationId ?? null,
          employerName: input.employerName,
          jobTitle: input.jobTitle,
          monthlySalary: input.monthlySalary,
          status: "pending_verification",
        }),
        riskLevel: "high",
        approvalId: offerAttributionApprovalId,
      });
      await createAuditEvent({
        userId,
        entityType: "success_fee",
        entityId: fee.id,
        action: "billing_action_approved",
        actor: "user",
        source: "successFees.reportHire",
        afterState: JSON.stringify({
          monthlyFeeAmount,
          feePercent: FEE_PERCENT,
          stripeSubscriptionSetup: "approved",
        }),
        riskLevel: "critical",
        approvalId: billingApprovalId,
      });
      await createAdminReviewItem({
        userId,
        entityType: "success_fee",
        entityId: fee.id,
        category: "offer_attribution",
        priority: "high",
        title: "Reported hire needs offer attribution review",
        description: `Reported hire at ${input.employerName} for ${input.jobTitle}.`,
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
        ledger: {
          offerProofStatus: "stored" as const,
          offerAttributionStatus: "admin_review_open" as const,
          verificationStatus: "pending_review" as const,
          billingSetupStatus: paymentIntent?.client_secret
            ? "payment_setup_required" as const
            : "subscription_created" as const,
          adminReviewRequired: true,
          offerAttributionApprovalId,
          billingApprovalId,
        },
      };
    }),

  // Get user's success fees
  getMyFees: protectedProcedure.query(async ({ ctx }) => {
    return await getUserSuccessFees(ctx.user.id);
  }),

  // Show offer responses/approvals that should be converted into reported hires.
  getOfferAttributionReviews: protectedProcedure.query(async ({ ctx }) => {
    return await getUserOfferAttributionReviews(ctx.user.id);
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
      const validation = validateUploadedFile({
        data: fileBuffer,
        fileName: input.documentFileName,
        mimeType: input.documentMimeType,
        allowedMimeTypes: VERIFICATION_MIME_TYPES,
      });
      const fileKey = `verifications/${userId}-${Date.now()}-${validation.fileName}`;
      const { url: documentUrl } = await storagePut(fileKey, fileBuffer, input.documentMimeType);

      // Create verification record. Do not extend the next verification due date here.
      // The deadline should only move after an admin approves the submitted document.
      const verificationResult = await db.insert(employmentVerifications).values({
        successFeeId: input.successFeeId,
        userId,
        verificationType: "quarterly",
        documentUrl,
        documentKey: fileKey,
        documentType: input.documentType,
        status: "pending",
        submittedAt: new Date(),
      });
      const verificationId = Number(verificationResult[0].insertId);

      await createAuditEvent({
        userId,
        entityType: "verification",
        entityId: verificationId,
        action: "employment_verification_submitted",
        actor: "user",
        source: "successFees.submitVerification",
        afterState: JSON.stringify({
          successFeeId: input.successFeeId,
          documentType: input.documentType,
          status: "pending",
          nextVerificationDue: fee.nextVerificationDue ?? null,
        }),
        riskLevel: "high",
      });
      await createAdminReviewItem({
        userId,
        entityType: "verification",
        entityId: verificationId,
        category: "verification_overdue",
        priority: "high",
        title: "Quarterly employment verification submitted",
        description: `User submitted ${input.documentType.replace(/_/g, " ")} proof for ${fee.employerName}. Admin approval is required before the next verification deadline moves.`,
      });

      return { success: true, status: "pending_review" as const, verificationId };
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

      const endDate = new Date(input.endDate);
      const decidedAt = new Date();
      const previousState = {
        status: fee.status,
        endDate: fee.endDate ?? null,
        stripeSubscriptionId: fee.stripeSubscriptionId ?? null,
        employerName: fee.employerName,
        jobTitle: fee.jobTitle,
      };

      const billingApproval = await db.insert(applicationApprovals).values({
        userId,
        applicationId: fee.applicationId ?? null,
        entityType: "billing",
        entityId: input.successFeeId,
        approvalType: "billing_action",
        status: "approved",
        riskLevel: "high",
        requestedBy: "user",
        decidedBy: "user",
        title: "Employment end reported",
        description: `User reported employment ended at ${fee.employerName}.`,
        payload: JSON.stringify({
          successFeeId: input.successFeeId,
          employerName: fee.employerName,
          jobTitle: fee.jobTitle,
          endDate,
          previousStatus: fee.status,
          stripeSubscriptionId: fee.stripeSubscriptionId ?? null,
        }),
        decisionNote: "User reported employment ended; final billing and verification require admin review.",
        requestedAt: decidedAt,
        decidedAt,
      });
      const billingApprovalId = Number(billingApproval[0].insertId);

      // Cancel Stripe subscription
      let stripeSubscriptionCancelled = false;
      if (fee.stripeSubscriptionId) {
        await getStripeClient().subscriptions.cancel(fee.stripeSubscriptionId);
        stripeSubscriptionCancelled = true;
      }

      // Update fee status
      await db.update(successFees)
        .set({ status: "ended", endDate })
        .where(eq(successFees.id, input.successFeeId));

      await createAuditEvent({
        userId,
        entityType: "success_fee",
        entityId: input.successFeeId,
        action: "employment_ended_reported",
        actor: "user",
        source: "successFees.reportEmploymentEnded",
        beforeState: JSON.stringify(previousState),
        afterState: JSON.stringify({
          status: "ended",
          endDate,
          stripeSubscriptionCancelled,
          adminReviewRequired: true,
        }),
        riskLevel: "high",
        approvalId: billingApprovalId,
      });
      await createAdminReviewItem({
        userId,
        entityType: "success_fee",
        entityId: input.successFeeId,
        category: "employment_ended",
        priority: "high",
        title: "Employment ended report needs review",
        description: `Employment at ${fee.employerName} for ${fee.jobTitle} was reported ended on ${input.endDate}. Review final billing, subscription cancellation, and verification context.`,
      });

      return {
        success: true,
        status: "pending_admin_review" as const,
        endedAt: endDate,
        stripeSubscriptionCancelled,
        approvalId: billingApprovalId,
      };
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
    const stripe = getStripeClient();
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
