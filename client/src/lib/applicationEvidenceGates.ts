export type ApplicationEvidenceGateSeverity = "low" | "medium" | "high";

export interface ApplicationEvidenceGateLike {
  id?: string | null;
  label?: string | null;
  detail?: string | null;
  severity?: string | null;
  route?: string | null;
  blocks?: string[] | null;
  affectedApplications?: number | null;
}

export interface ApplicationEvidenceGateApplicationLike {
  status?: string | null;
}

export interface ApplicationApprovalEvidenceGateLike {
  approvalType?: string | null;
}

export interface ApplicationEvidenceGateSummary {
  gates: ApplicationEvidenceGateLike[];
  count: number;
  highestSeverity: ApplicationEvidenceGateSeverity;
  headline: string;
  detail: string;
  route: string;
  blockedCapabilities: string[];
}

const SEVERITY_RANK: Record<ApplicationEvidenceGateSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

const FOLLOW_UP_STATUSES = new Set(["applied", "viewed", "interview"]);

function coerceSeverity(value?: string | null): ApplicationEvidenceGateSeverity {
  return value === "high" || value === "medium" || value === "low" ? value : "medium";
}

function readableBlock(block: string) {
  return block.replace(/_/g, " ");
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function applicableBlocksForApplication(
  application: ApplicationEvidenceGateApplicationLike | null | undefined,
  gate: ApplicationEvidenceGateLike
) {
  const status = application?.status || "pending";
  const blocks = gate.blocks || [];
  if (status === "pending") {
    return blocks.filter((block) => block === "external_application_submission");
  }
  if (FOLLOW_UP_STATUSES.has(status)) {
    return blocks.filter((block) => block === "follow_up_send" || block === "reply_monitoring");
  }
  return [];
}

export function getApplicationEvidenceGateSummary(
  application: ApplicationEvidenceGateApplicationLike | null | undefined,
  gates: ApplicationEvidenceGateLike[] = []
): ApplicationEvidenceGateSummary {
  const relevantGates = gates.filter((gate) => applicableBlocksForApplication(application, gate).length > 0);
  const highestSeverity = relevantGates.reduce<ApplicationEvidenceGateSeverity>((current, gate) => {
    const severity = coerceSeverity(gate.severity);
    return SEVERITY_RANK[severity] > SEVERITY_RANK[current] ? severity : current;
  }, "low");
  const blockedCapabilities = unique(
    relevantGates.flatMap((gate) => applicableBlocksForApplication(application, gate).map(readableBlock))
  );
  const firstGate = relevantGates[0];

  if (relevantGates.length === 0) {
    return {
      gates: [],
      count: 0,
      highestSeverity: "low",
      headline: "No evidence gates block this application.",
      detail: "Application actions can follow their normal approval, evidence, and response workflow.",
      route: "/profile",
      blockedCapabilities: [],
    };
  }

  return {
    gates: relevantGates,
    count: relevantGates.length,
    highestSeverity,
    headline: `${relevantGates.length} evidence gate${relevantGates.length === 1 ? "" : "s"} block external work for this application.`,
    detail: firstGate?.detail || "Resolve missing profile or connector evidence before advancing external actions.",
    route: firstGate?.route || "/profile",
    blockedCapabilities,
  };
}

export function getApprovalEvidenceGateSummary(
  approval: ApplicationApprovalEvidenceGateLike | null | undefined,
  gates: ApplicationEvidenceGateLike[] = []
): ApplicationEvidenceGateSummary {
  if (approval?.approvalType !== "application_submission") {
    return getApplicationEvidenceGateSummary({ status: "withdrawn" }, gates);
  }

  return getApplicationEvidenceGateSummary({ status: "pending" }, gates);
}
