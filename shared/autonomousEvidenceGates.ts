import type { ProfileEvidenceControlSummary } from "./profileEvidence";

export type AutonomousEvidenceGateSeverity = "low" | "medium" | "high";

export type AutonomousEvidenceGateBlocks =
  | "external_application_submission"
  | "follow_up_send"
  | "reply_monitoring"
  | "document_discovery";

export interface AutonomousEvidenceGate {
  id: string;
  label: string;
  detail: string;
  severity: AutonomousEvidenceGateSeverity;
  route: string;
  blocks: AutonomousEvidenceGateBlocks[];
  providerIds?: string[];
  affectedApplications?: number;
}

export interface ConnectorReadinessGateInput {
  id: string;
  label: string;
  detail: string;
  providerIds?: string[];
  riskLevel?: AutonomousEvidenceGateSeverity;
  affectedApplications?: number;
}

export interface AutonomousEvidenceGateInput {
  profileEvidence?: ProfileEvidenceControlSummary | null;
  connectorReadiness?: ConnectorReadinessGateInput[] | null;
}

function uniqueBlocks(blocks: AutonomousEvidenceGateBlocks[]) {
  return Array.from(new Set(blocks));
}

function connectorBlocks(item: ConnectorReadinessGateInput): AutonomousEvidenceGateBlocks[] {
  const providerIds = item.providerIds || [];
  const blocks: AutonomousEvidenceGateBlocks[] = [];

  if (providerIds.some((providerId) => ["gmail", "outlook"].includes(providerId))) {
    blocks.push("reply_monitoring", "follow_up_send");
  }
  if (providerIds.some((providerId) => ["google_drive", "dropbox"].includes(providerId))) {
    blocks.push("document_discovery");
  }
  return uniqueBlocks(blocks);
}

export function buildAutonomousEvidenceGates(
  input: AutonomousEvidenceGateInput
): AutonomousEvidenceGate[] {
  const gates: AutonomousEvidenceGate[] = [];
  const profileEvidence = input.profileEvidence;

  if (profileEvidence?.status === "blocked") {
    gates.push({
      id: "profile-core-evidence",
      label: profileEvidence.label,
      detail: profileEvidence.detail,
      severity: "high",
      route: "/profile",
      blocks: ["external_application_submission", "follow_up_send"],
    });
  }

  for (const item of input.connectorReadiness || []) {
    const blocks = connectorBlocks(item);
    if (blocks.length === 0) continue;

    gates.push({
      id: `connector-${item.id}`,
      label: item.label,
      detail: item.detail,
      severity: item.riskLevel || "medium",
      route: "/profile",
      blocks,
      providerIds: item.providerIds,
      affectedApplications: item.affectedApplications,
    });
  }

  return gates;
}

export function countEvidenceGatedActions(input: {
  gates?: AutonomousEvidenceGate[] | null;
  applicationSubmissionCandidates?: number;
  followUpSendCandidates?: number;
}) {
  const gates = input.gates || [];
  const applicationSubmissionCandidates = input.applicationSubmissionCandidates || 0;
  const followUpSendCandidates = input.followUpSendCandidates || 0;
  const applicationSubmissionsBlocked = gates.some((gate) =>
    gate.blocks.includes("external_application_submission")
  )
    ? applicationSubmissionCandidates
    : 0;
  const followUpsBlocked = gates.some((gate) =>
    gate.blocks.includes("follow_up_send") || gate.blocks.includes("reply_monitoring")
  )
    ? followUpSendCandidates
    : 0;

  return {
    applicationSubmissionsBlocked,
    followUpsBlocked,
    total: applicationSubmissionsBlocked + followUpsBlocked,
  };
}
