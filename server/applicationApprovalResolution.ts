import type { ApplicationApproval } from "../drizzle/schema";

export type ApprovalResolutionStatus = "approved" | "rejected" | "cancelled";

export function shouldRecordApplicationSubmissionGateAttempt(
  approval: Pick<ApplicationApproval, "approvalType"> & {
    applicationId?: number | null;
  }
) {
  return approval.approvalType === "application_submission" && approval.applicationId != null;
}

export function getApplicationSubmissionGateAttemptStatus(status: ApprovalResolutionStatus) {
  return status === "approved" ? "prepared" : "cancelled";
}

export function getApplicationSubmissionGateAttemptText(
  approval: Pick<ApplicationApproval, "approvalType"> & {
    title?: string | null;
    description?: string | null;
  },
  status: ApprovalResolutionStatus,
  decisionNote?: string | null
) {
  const action = status === "approved"
    ? "User approved this prepared application for manual external handoff."
    : status === "rejected"
      ? "User rejected this prepared application; external handoff is cancelled."
      : "User cancelled this prepared application approval gate.";
  const note = decisionNote?.trim()
    ? ` Decision note: ${decisionNote.trim()}`
    : "";
  const source = approval.title || approval.description
    ? ` Approval context: ${approval.title || approval.approvalType}${approval.description ? ` - ${approval.description}` : ""}.`
    : "";

  return `${action} No external submission was recorded by this approval.${note}${source}`;
}
