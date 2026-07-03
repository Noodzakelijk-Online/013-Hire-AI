export interface AutonomousEvidenceGateSummaryInput {
  evidenceGates?: Array<{
    severity?: string | null;
    blocks?: string[] | null;
  }> | null;
}

export function getAutonomousEvidenceGateSummary(input?: AutonomousEvidenceGateSummaryInput | null) {
  const gates = input?.evidenceGates || [];
  const blocks = new Set(gates.flatMap((gate) => gate.blocks || []));

  return {
    total: gates.length,
    high: gates.filter((gate) => gate.severity === "high").length,
    medium: gates.filter((gate) => gate.severity === "medium").length,
    low: gates.filter((gate) => gate.severity === "low").length,
    externalApplicationGated: blocks.has("external_application_submission"),
    followUpGated: blocks.has("follow_up_send"),
    replyMonitoringGated: blocks.has("reply_monitoring"),
    documentDiscoveryGated: blocks.has("document_discovery"),
  };
}

export function getAutonomousEvidenceGateSummaryText(input?: AutonomousEvidenceGateSummaryInput | null) {
  const summary = getAutonomousEvidenceGateSummary(input);
  if (summary.total === 0) return "No active evidence gates";

  const blockedSurfaces: string[] = [];
  if (summary.externalApplicationGated) blockedSurfaces.push("application submission");
  if (summary.followUpGated) blockedSurfaces.push("follow-up sending");
  if (summary.replyMonitoringGated) blockedSurfaces.push("reply monitoring");
  if (summary.documentDiscoveryGated) blockedSurfaces.push("document discovery");

  return blockedSurfaces.length > 0
    ? `${summary.total} evidence gate${summary.total === 1 ? "" : "s"} active: ${blockedSurfaces.join(", ")}.`
    : `${summary.total} evidence gate${summary.total === 1 ? "" : "s"} active.`;
}
