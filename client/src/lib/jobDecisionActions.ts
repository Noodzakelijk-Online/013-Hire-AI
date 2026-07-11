export type JobDecisionLifecycleAction = "queue_review" | "save" | "ignore";

export interface JobDecisionActionJobLike {
  id: number;
  title?: string | null;
  company?: string | null;
}

export interface JobDecisionActionSummaryLike {
  matchScore: number;
  riskLevel: "low" | "medium" | "high";
  decisionLabel: string;
  nextAction: string;
  blockers: string[];
  missingSkills: string[];
  ledgerDecision?: string | null;
  ledgerDecisionReason?: string | null;
  ledgerReviewReason?: string | null;
}

export interface JobDecisionMutationInput {
  jobId: number;
  decision: "save" | "ignore" | "review";
  decisionReason: string;
  matchScore: number;
  riskLevel: "low" | "medium" | "high";
  reviewRequired: boolean;
  reviewReason?: string;
}

function jobLabel(job: JobDecisionActionJobLike) {
  return `${job.title || "this role"} at ${job.company || "the employer"}`;
}

function reviewContext(summary: JobDecisionActionSummaryLike) {
  return [
    summary.nextAction,
    summary.ledgerReviewReason ? `Previous review context: ${summary.ledgerReviewReason}` : "",
    summary.blockers.length > 0 ? `Blockers: ${summary.blockers.join("; ")}` : "",
    summary.missingSkills.length > 0 ? `Missing skills to verify: ${summary.missingSkills.join(", ")}` : "",
  ].filter(Boolean).join(" ");
}

export function getJobDecisionActionLabel(action: JobDecisionLifecycleAction) {
  switch (action) {
    case "queue_review":
      return "Reopen Review";
    case "save":
      return "Save for Later";
    case "ignore":
      return "Ignore";
  }
}

export function buildJobDecisionMutationInput(
  job: JobDecisionActionJobLike,
  summary: JobDecisionActionSummaryLike,
  action: JobDecisionLifecycleAction
): JobDecisionMutationInput {
  if (action === "ignore") {
    return {
      jobId: job.id,
      decision: "ignore",
      decisionReason: [
        `Ignored ${jobLabel(job)} from Job Search.`,
        summary.ledgerDecision ? `Previous ledger decision: ${summary.ledgerDecision}.` : "",
        summary.ledgerDecisionReason ? `Previous reason: ${summary.ledgerDecisionReason}` : "",
      ].filter(Boolean).join(" "),
      matchScore: summary.matchScore,
      riskLevel: "low",
      reviewRequired: false,
    };
  }

  if (action === "save") {
    return {
      jobId: job.id,
      decision: "save",
      decisionReason: [
        `Saved ${jobLabel(job)} for later review from Job Search.`,
        summary.ledgerDecision ? `Previous ledger decision: ${summary.ledgerDecision}.` : "",
        summary.nextAction,
      ].filter(Boolean).join(" "),
      matchScore: summary.matchScore,
      riskLevel: summary.riskLevel === "high" ? "medium" : summary.riskLevel,
      reviewRequired: true,
      reviewReason: summary.missingSkills.length > 0
        ? `Saved to review missing skills: ${summary.missingSkills.join(", ")}.`
        : "Saved for later review from Job Search.",
    };
  }

  return {
    jobId: job.id,
    decision: "review",
    decisionReason: [
      `Reopened ${jobLabel(job)} for controlled application review from Job Search.`,
      summary.ledgerDecision ? `Previous ledger decision: ${summary.ledgerDecision}.` : "",
      summary.ledgerDecisionReason ? `Previous reason: ${summary.ledgerDecisionReason}` : "",
    ].filter(Boolean).join(" "),
    matchScore: summary.matchScore,
    riskLevel: summary.riskLevel === "low" ? "medium" : summary.riskLevel,
    reviewRequired: true,
    reviewReason: reviewContext(summary),
  };
}
