import { isJobListingCurrent, type JobListingFreshnessInput } from "./jobListingFreshness";

export type ListingSafetyStatus = "clear" | "review" | "blocked";

export type ListingSafetyInput = JobListingFreshnessInput & {
  title?: string | null;
  company?: string | null;
  description?: string | null;
  requirements?: string | null;
  responsibilities?: string | null;
  benefits?: string | null;
  applicationUrl?: string | null;
  applicationEmail?: string | null;
};

export interface ListingSafetyAssessment {
  status: ListingSafetyStatus;
  reasons: string[];
  current: boolean;
  eligibleForAutonomousPreparation: boolean;
}

const blockedSignals: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\b(pay|send|wire|transfer)\b.{0,45}\b(fee|money|funds|deposit)\b/i, reason: "The listing requests money or a payment before employment." },
  { pattern: /\b(cash|deposit)\b.{0,35}\b(check|cheque)\b/i, reason: "The listing mentions check handling, a common recruiting scam signal." },
  { pattern: /\b(gift ?card|bitcoin|crypto(?:currency)?|wire transfer)\b/i, reason: "The listing requests an unusual form of payment." },
  { pattern: /\b(reship|re-ship|package forwarding|financial agent)\b/i, reason: "The listing contains a package or financial-forwarding signal." },
];

const reviewSignals: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bno interview\b|\bno experience necessary\b/i, reason: "The hiring process description is unusually thin and needs review." },
  { pattern: /\bimmediate start\b.{0,60}\bhigh income\b|\bguaranteed income\b/i, reason: "The compensation claim needs review before any contact." },
];

const consumerEmailDomains = new Set([
  "gmail.com",
  "outlook.com",
  "hotmail.com",
  "yahoo.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
]);

function listingText(listing: ListingSafetyInput) {
  return [
    listing.title,
    listing.company,
    listing.description,
    listing.requirements,
    listing.responsibilities,
    listing.benefits,
  ].filter(Boolean).join(" ");
}

function hasConsumerEmailDomain(value?: string | null) {
  const domain = value?.trim().toLowerCase().split("@").at(-1);
  return Boolean(domain && consumerEmailDomains.has(domain));
}

/**
 * This is intentionally a conservative risk triage, not a claim that a
 * listing is fraudulent. Only explicit payment or forwarding signals block
 * automated preparation; weaker signals remain visible for human review.
 */
export function assessListingSafety(
  listing: ListingSafetyInput,
  now = new Date()
): ListingSafetyAssessment {
  const current = isJobListingCurrent(listing, now);
  const text = listingText(listing);
  const blocked = blockedSignals.filter((signal) => signal.pattern.test(text));

  if (blocked.length > 0) {
    return {
      status: "blocked",
      reasons: Array.from(new Set(blocked.map((signal) => signal.reason))),
      current,
      eligibleForAutonomousPreparation: false,
    };
  }

  const reasons = reviewSignals
    .filter((signal) => signal.pattern.test(text))
    .map((signal) => signal.reason);
  if (hasConsumerEmailDomain(listing.applicationEmail)) {
    reasons.push("The application destination uses a consumer email domain and needs review.");
  }
  const status: ListingSafetyStatus = reasons.length > 0 ? "review" : "clear";
  return {
    status,
    reasons: Array.from(new Set(reasons)),
    current,
    eligibleForAutonomousPreparation: current && status === "clear",
  };
}
