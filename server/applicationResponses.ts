import type { ApplicationStatus } from "./applicationLifecycle";

export type EmployerResponseType =
  | "viewed"
  | "rejection"
  | "interview_invite"
  | "offer"
  | "employer_question"
  | "other";

export type EmployerResponseSource =
  | "email"
  | "employer_portal"
  | "linkedin"
  | "phone"
  | "other";

export interface EmployerResponseInput {
  responseType: EmployerResponseType;
  source: EmployerResponseSource;
  sourceReference?: string | null;
  summary: string;
  receivedAt?: Date;
}

export interface NormalizedEmployerResponse {
  responseType: EmployerResponseType;
  source: EmployerResponseSource;
  sourceReference: string | null;
  summary: string;
  receivedAt: Date;
  nextStatus: ApplicationStatus | null;
  noteContent: string;
}

export function normalizeEmployerResponseSourceReference(value?: string | null): string | null {
  if (value == null) return null;

  const reference = value.trim();
  if (!reference) return null;
  if (reference.length < 3) {
    throw new Error("Employer response source reference is too short.");
  }
  if (reference.length > 320) {
    throw new Error("Employer response source reference is too long.");
  }
  if (/\s/.test(reference)) {
    throw new Error("Employer response source reference cannot contain whitespace.");
  }
  return reference;
}

const TYPE_LABELS: Record<EmployerResponseType, string> = {
  viewed: "application viewed",
  rejection: "rejection",
  interview_invite: "interview invite",
  offer: "offer",
  employer_question: "employer question",
  other: "other employer response",
};

const SOURCE_LABELS: Record<EmployerResponseSource, string> = {
  email: "email",
  employer_portal: "employer portal",
  linkedin: "LinkedIn",
  phone: "phone",
  other: "other source",
};

export function resolveEmployerResponseStatus(
  currentStatus: ApplicationStatus,
  responseType: EmployerResponseType
): ApplicationStatus | null {
  switch (responseType) {
    case "viewed":
    case "employer_question":
      return currentStatus === "applied" ? "viewed" : null;
    case "rejection":
      return "rejected";
    case "interview_invite":
      return "interview";
    case "offer":
      return "offer";
    case "other":
      return null;
  }
}

export function normalizeEmployerResponse(
  input: EmployerResponseInput,
  currentStatus: ApplicationStatus,
  now = new Date()
): NormalizedEmployerResponse {
  if (currentStatus === "pending") {
    throw new Error("Employer responses can only be recorded after submission is confirmed.");
  }

  const summary = input.summary.trim().replace(/\r\n/g, "\n");
  const sourceReference = normalizeEmployerResponseSourceReference(input.sourceReference);
  if (summary.length < 8) {
    throw new Error("Employer response summary must describe what happened.");
  }
  if (summary.length > 5000) {
    throw new Error("Employer response summary is too long.");
  }

  const receivedAt = input.receivedAt || now;
  if (receivedAt.getTime() > now.getTime() + 60_000) {
    throw new Error("Employer response time cannot be in the future.");
  }

  const nextStatus = resolveEmployerResponseStatus(currentStatus, input.responseType);
  const lines = [
    `Employer response recorded: ${TYPE_LABELS[input.responseType]} via ${SOURCE_LABELS[input.source]}.`,
    `Received: ${receivedAt.toISOString()}`,
    `Summary: ${summary}`,
  ];
  if (nextStatus) {
    lines.push(`Ledger status recommendation: ${nextStatus}.`);
  }

  return {
    responseType: input.responseType,
    source: input.source,
    sourceReference,
    summary,
    receivedAt,
    nextStatus,
    noteContent: lines.join("\n"),
  };
}
