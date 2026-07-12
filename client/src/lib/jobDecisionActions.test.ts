import { describe, expect, it } from "vitest";
import { buildJobDecisionMutationInput, buildJobPreparationDecisionInput } from "./jobDecisionActions";

const job = {
  id: 42,
  title: "Senior Frontend Engineer",
  company: "Acme",
};

const summary = {
  matchScore: 88,
  riskLevel: "low" as const,
  decisionLabel: "Queue for review",
  nextAction: "Queue this job for controlled review.",
  blockers: [],
  missingSkills: ["GraphQL"],
  ledgerDecision: "ignore",
  ledgerDecisionReason: "User rejected this company last week.",
  ledgerReviewReason: "Previous uncertainty about salary.",
};

describe("job decision action payloads", () => {
  it("reopens a stale ledger decision as a review-required application decision", () => {
    const input = buildJobDecisionMutationInput(job, summary, "queue_review");

    expect(input).toMatchObject({
      jobId: 42,
      decision: "review",
      matchScore: 88,
      riskLevel: "medium",
      reviewRequired: true,
    });
    expect(input.decisionReason).toContain("Reopened Senior Frontend Engineer at Acme");
    expect(input.decisionReason).toContain("Previous ledger decision: ignore");
    expect(input.reviewReason).toContain("Previous review context");
    expect(input.reviewReason).toContain("Missing skills to verify: GraphQL");
  });

  it("ignores a job without leaving it in the review queue", () => {
    const input = buildJobDecisionMutationInput(job, summary, "ignore");

    expect(input.decision).toBe("ignore");
    expect(input.riskLevel).toBe("low");
    expect(input.reviewRequired).toBe(false);
    expect(input.reviewReason).toBeUndefined();
    expect(input.decisionReason).toContain("Previous reason");
  });

  it("uses the controlled review payload when a saved job is prepared", () => {
    const input = buildJobPreparationDecisionInput(job, summary, "Saved Jobs");

    expect(input).toMatchObject({
      jobId: 42,
      decision: "review",
      matchScore: 88,
      riskLevel: "low",
      reviewRequired: true,
    });
    expect(input.decisionReason).toContain("Queued from Saved Jobs");
    expect(input.reviewReason).toContain("Missing skills to verify: GraphQL");
  });
});
