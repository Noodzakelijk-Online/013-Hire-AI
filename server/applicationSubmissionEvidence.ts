export type SubmissionEvidenceSource =
  | "manual"
  | "employer_portal"
  | "email_confirmation"
  | "ats_confirmation";

export interface SubmissionEvidenceInput {
  source: SubmissionEvidenceSource;
  evidence: string;
  confirmationUrl?: string | null;
}

export interface NormalizedSubmissionEvidence {
  source: SubmissionEvidenceSource;
  evidence: string;
  confirmationUrl: string | null;
  noteContent: string;
}

const SOURCE_LABELS: Record<SubmissionEvidenceSource, string> = {
  manual: "manual confirmation",
  employer_portal: "employer portal confirmation",
  email_confirmation: "email confirmation",
  ats_confirmation: "ATS confirmation",
};

export function normalizeSubmissionEvidence(
  input: SubmissionEvidenceInput
): NormalizedSubmissionEvidence {
  const evidence = input.evidence.trim().replace(/\r\n/g, "\n");
  if (evidence.length < 8) {
    throw new Error("Submission evidence must describe what confirmed the application.");
  }
  if (evidence.length > 5000) {
    throw new Error("Submission evidence is too long.");
  }

  const confirmationUrl = input.confirmationUrl?.trim() || null;
  if (confirmationUrl) {
    const parsed = new URL(confirmationUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Confirmation URL must use HTTP or HTTPS.");
    }
  }

  const lines = [
    `Submission confirmed via ${SOURCE_LABELS[input.source]}.`,
    `Evidence: ${evidence}`,
  ];
  if (confirmationUrl) {
    lines.push(`Confirmation URL: ${confirmationUrl}`);
  }

  return {
    source: input.source,
    evidence,
    confirmationUrl,
    noteContent: lines.join("\n"),
  };
}
