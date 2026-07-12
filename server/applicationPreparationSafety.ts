import { getAutonomousEvidenceContext } from "./autonomousEvidence";

export interface ApplicationPreparationSafety {
  allowed: boolean;
  readinessScore: number;
  blockers: Array<{
    key: string;
    label: string;
    recommendation: string;
  }>;
}

export async function getApplicationPreparationSafety(
  userId: number
): Promise<ApplicationPreparationSafety> {
  const context = await getAutonomousEvidenceContext(userId);
  return {
    // Preparing review-only materials is allowed once core evidence is complete.
    // The stricter score threshold remains reserved for autonomous action.
    allowed: context.readiness.blockers.length === 0,
    readinessScore: context.readiness.score,
    blockers: context.readiness.blockers.map((gap) => ({
      key: gap.key,
      label: gap.label,
      recommendation: gap.recommendation,
    })),
  };
}

export function applicationPreparationBlockMessage(safety: ApplicationPreparationSafety) {
  const labels = safety.blockers.map((blocker) => blocker.label);
  const recommendation = safety.blockers[0]?.recommendation;
  return [
    "Core profile evidence is required before Hire.AI can prepare an application.",
    labels.length > 0 ? `Missing: ${labels.join(", ")}.` : "",
    recommendation || "Complete the candidate profile before preparing application materials.",
  ].filter(Boolean).join(" ");
}
