import type { AdminOperatingSummary } from "./adminOperatingSummary";

export type AdminOperatingControlStatus =
  | "critical"
  | "attention"
  | "watch"
  | "clear";

export type AdminOperatingControlRisk = "low" | "medium" | "high" | "critical";

export type AdminOperatingControlTab =
  | "overview"
  | "overdue"
  | "verifications"
  | "review"
  | "payments";

export type AdminOperatingControlActionId =
  | "review_legal"
  | "review_failed_payments"
  | "review_grace_expired_verifications"
  | "review_offer_attribution"
  | "review_employment_ended"
  | "review_overdue_verifications"
  | "review_pending_verifications"
  | "open_review_queue"
  | "monitor";

export interface AdminOperatingControlAction {
  id: AdminOperatingControlActionId;
  status: AdminOperatingControlStatus;
  label: string;
  headline: string;
  detail: string;
  cta: string;
  tab: AdminOperatingControlTab;
  risk: AdminOperatingControlRisk;
  approvalGated: boolean;
}

function plural(count: number, singular: string, pluralWord = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralWord}`;
}

function verb(count: number, singular: string, pluralWord: string) {
  return count === 1 ? singular : pluralWord;
}

export function getAdminOperatingControlAction(
  summary: AdminOperatingSummary
): AdminOperatingControlAction {
  if (summary.legalEscalations > 0) {
    return {
      id: "review_legal",
      status: "critical",
      label: "Legal review",
      headline: `${plural(summary.legalEscalations, "legal escalation")} ${verb(summary.legalEscalations, "requires", "require")} manual admin review.`,
      detail: "Open the review queue and inspect evidence, ToS acceptance, billing records, and prior admin decisions before any enforcement step.",
      cta: "Open legal review",
      tab: "review",
      risk: "critical",
      approvalGated: true,
    };
  }

  if (summary.failedPayments > 0) {
    return {
      id: "review_failed_payments",
      status: "critical",
      label: "Failed payments",
      headline: `${plural(summary.failedPayments, "failed payment")} ${verb(summary.failedPayments, "needs", "need")} billing review.`,
      detail: "Review payment status and account history before changing access, billing state, or subscription records.",
      cta: "Open payments",
      tab: "payments",
      risk: "high",
      approvalGated: true,
    };
  }

  if (summary.graceExpiredVerifications > 0) {
    return {
      id: "review_grace_expired_verifications",
      status: "critical",
      label: "Grace expired",
      headline: `${plural(summary.graceExpiredVerifications, "verification")} ${verb(summary.graceExpiredVerifications, "has", "have")} passed the grace window.`,
      detail: "Review proof, reminders, and account context before suspension, escalation, or billing changes.",
      cta: "Open overdue",
      tab: "overdue",
      risk: "high",
      approvalGated: true,
    };
  }

  if (summary.offerAttributionReviews > 0) {
    return {
      id: "review_offer_attribution",
      status: "attention",
      label: "Offer attribution",
      headline: `${plural(summary.offerAttributionReviews, "offer")} ${verb(summary.offerAttributionReviews, "needs", "need")} attribution review before billing.`,
      detail: "Confirm whether each offer came from Hire.AI activity before any success-fee subscription or invoice is created.",
      cta: "Open offer reviews",
      tab: "review",
      risk: "high",
      approvalGated: true,
    };
  }

  if (summary.employmentEndedReviews > 0) {
    return {
      id: "review_employment_ended",
      status: "attention",
      label: "Employment ended",
      headline: `${plural(summary.employmentEndedReviews, "employment-end report")} ${verb(summary.employmentEndedReviews, "needs", "need")} final review.`,
      detail: "Confirm final billing period, subscription cancellation, verification history, and audit evidence before closing the success-fee obligation.",
      cta: "Open end reports",
      tab: "review",
      risk: "high",
      approvalGated: true,
    };
  }

  if (summary.overdueVerifications > 0) {
    return {
      id: "review_overdue_verifications",
      status: "attention",
      label: "Overdue verification",
      headline: `${plural(summary.overdueVerifications, "verification")} ${verb(summary.overdueVerifications, "is", "are")} overdue.`,
      detail: "Work overdue employment checks first and keep account actions auditable.",
      cta: "Open overdue",
      tab: "overdue",
      risk: "high",
      approvalGated: true,
    };
  }

  if (summary.pendingVerifications > 0) {
    return {
      id: "review_pending_verifications",
      status: "watch",
      label: "Verification queue",
      headline: `${plural(summary.pendingVerifications, "verification")} ${verb(summary.pendingVerifications, "awaits", "await")} review.`,
      detail: "Approve or reject submitted employment proof from the verification queue.",
      cta: "Open verifications",
      tab: "verifications",
      risk: "medium",
      approvalGated: true,
    };
  }

  if (summary.totalOpenWork > 0) {
    return {
      id: "open_review_queue",
      status: "watch",
      label: "Review queue",
      headline: `${plural(summary.totalOpenWork, "admin item")} ${verb(summary.totalOpenWork, "is", "are")} waiting.`,
      detail: "Clear admin-visible operating items before making more consequential changes.",
      cta: "Open review queue",
      tab: "review",
      risk: "medium",
      approvalGated: true,
    };
  }

  return {
    id: "monitor",
    status: "clear",
    label: "Monitoring",
    headline: "No admin intervention is currently queued.",
    detail: "Keep monitoring success-fee revenue, verification cadence, review items, and failed payments.",
    cta: "View overview",
    tab: "overview",
    risk: "low",
    approvalGated: false,
  };
}
