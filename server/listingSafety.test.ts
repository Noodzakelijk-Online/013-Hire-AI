import { describe, expect, it } from "vitest";
import { assessListingSafety } from "../shared/listingSafety";

const now = new Date("2026-07-14T12:00:00.000Z");

function currentListing(overrides: Record<string, unknown> = {}) {
  return {
    title: "Senior Product Engineer",
    company: "Northstar Systems",
    description: "Build accessible remote software for global teams.",
    applicationUrl: "https://jobs.northstar.example/apply/123",
    isActive: 1,
    updatedAt: new Date(now.getTime() - 86400000),
    ...overrides,
  };
}

describe("listing safety assessment", () => {
  it("allows a current listing with no explicit risk signals", () => {
    expect(assessListingSafety(currentListing(), now)).toMatchObject({
      status: "clear",
      current: true,
      eligibleForAutonomousPreparation: true,
    });
  });

  it("blocks explicit payment and check-handling requests without calling them fraud", () => {
    const assessment = assessListingSafety(currentListing({
      description: "Deposit the company check, keep your fee, and transfer the remaining funds.",
    }), now);

    expect(assessment.status).toBe("blocked");
    expect(assessment.eligibleForAutonomousPreparation).toBe(false);
    expect(assessment.reasons.join(" ")).toContain("check handling");
  });

  it("keeps ambiguous signals in a review state", () => {
    const assessment = assessListingSafety(currentListing({
      applicationEmail: "role.recruiting@gmail.com",
    }), now);

    expect(assessment.status).toBe("review");
    expect(assessment.eligibleForAutonomousPreparation).toBe(false);
  });

  it("does not treat a stale observation as eligible for autonomous preparation", () => {
    const assessment = assessListingSafety(currentListing({
      updatedAt: new Date(now.getTime() - 15 * 86400000),
    }), now);

    expect(assessment).toMatchObject({ current: false, eligibleForAutonomousPreparation: false });
  });
});
