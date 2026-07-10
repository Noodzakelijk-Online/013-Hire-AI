/**
 * Automated Application System
 * Detects ATS (Applicant Tracking System) and automates job applications
 */

import {
  normalizeSubmissionEvidence,
  type NormalizedSubmissionEvidence,
  type SubmissionEvidenceInput,
} from "./applicationSubmissionEvidence";

export type ATSType = "greenhouse" | "lever" | "workday" | "taleo" | "smartrecruiters" | "unknown";

export interface ApplicationData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  resumeUrl: string;
  coverLetter?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  answers?: Record<string, string>; // For custom questions
}

export interface ApplicationResult {
  success: boolean;
  prepared: boolean;
  submissionAttempted: boolean;
  /** True only when an external submission actually completed. */
  externalSubmissionPerformed: boolean;
  reviewRequired: boolean;
  atsType: ATSType;
  message: string;
  confirmationId?: string;
  submissionEvidence?: SubmissionEvidenceInput;
  error?: string;
}

/**
 * Detect ATS type from application URL
 */
export function detectATSType(url: string): ATSType {
  const urlLower = url.toLowerCase();

  if (urlLower.includes("greenhouse.io") || urlLower.includes("boards.greenhouse.io")) {
    return "greenhouse";
  }

  if (urlLower.includes("lever.co") || urlLower.includes("jobs.lever.co")) {
    return "lever";
  }

  if (urlLower.includes("myworkday") || urlLower.includes("workday.com")) {
    return "workday";
  }

  if (urlLower.includes("taleo.net") || urlLower.includes("tbe.taleo.net")) {
    return "taleo";
  }

  if (urlLower.includes("smartrecruiters.com") || urlLower.includes("jobs.smartrecruiters.com")) {
    return "smartrecruiters";
  }

  return "unknown";
}

/**
 * Prepare an application for a guarded user-review handoff.
 * Final submission is intentionally not attempted by this service.
 */
export async function applyToJob(
  applicationUrl: string,
  applicationData: ApplicationData
): Promise<ApplicationResult> {
  const atsType = detectATSType(applicationUrl);

  console.log(`[ApplicationAutomation] Detected ATS: ${atsType}`);
  console.log(`[ApplicationAutomation] Application URL: ${applicationUrl}`);

  // Final submission remains disabled until a reviewable browser handoff exists.
  return {
    success: false,
    prepared: true,
    submissionAttempted: false,
    externalSubmissionPerformed: false,
    reviewRequired: true,
    atsType,
    message: `Application data is ready, but ${atsType} submission requires user review and manual confirmation.`,
    error: "Final submission is disabled",
  };
}

/**
 * Converts an automation result into recordable submission proof. A successful
 * preparation result is deliberately insufficient: the ledger only moves to
 * "applied" when an external submission, explicit evidence, and no review
 * requirement are all present.
 */
export function getVerifiedApplicationSubmissionEvidence(
  result: ApplicationResult
): NormalizedSubmissionEvidence | null {
  if (
    !result.success ||
    !result.submissionAttempted ||
    !result.externalSubmissionPerformed ||
    result.reviewRequired ||
    !result.submissionEvidence
  ) {
    return null;
  }

  try {
    return normalizeSubmissionEvidence(result.submissionEvidence);
  } catch {
    return null;
  }
}

/**
 * Validate application data
 */
export function validateApplicationData(data: ApplicationData): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!data.firstName || data.firstName.trim() === "") {
    errors.push("First name is required");
  }

  if (!data.lastName || data.lastName.trim() === "") {
    errors.push("Last name is required");
  }

  if (!data.email || !data.email.includes("@")) {
    errors.push("Valid email is required");
  }

  if (!data.resumeUrl || data.resumeUrl.trim() === "") {
    errors.push("Resume URL is required");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Prepare application data from user profile
 */
export function prepareApplicationData(
  user: { name?: string | null; email?: string | null },
  profile: {
    resumeUrl?: string | null;
    linkedinUrl?: string | null;
    githubUrl?: string | null;
    portfolioUrl?: string | null;
  },
  coverLetter?: string
): ApplicationData | null {
  // Parse name
  const nameParts = (user.name || "").split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  if (!firstName || !user.email || !profile.resumeUrl) {
    return null;
  }

  return {
    firstName,
    lastName,
    email: user.email,
    resumeUrl: profile.resumeUrl,
    coverLetter,
    linkedinUrl: profile.linkedinUrl || undefined,
    githubUrl: profile.githubUrl || undefined,
    portfolioUrl: profile.portfolioUrl || undefined,
  };
}

/**
 * Check if automated application is supported for a URL
 */
export function isAutomationSupported(url: string): {
  supported: boolean;
  preparationSupported: boolean;
  atsType: ATSType;
  message: string;
} {
  const atsType = detectATSType(url);
  const preparationSupported = ["greenhouse", "lever"].includes(atsType);

  return {
    supported: false,
    preparationSupported,
    atsType,
    message: preparationSupported
      ? `${atsType} forms can be prepared, but a person must review and submit them.`
      : `Automated application requires review for ${atsType}. Manual application may be required.`,
  };
}
