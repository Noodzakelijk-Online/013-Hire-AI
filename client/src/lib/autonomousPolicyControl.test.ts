import { describe, expect, it } from "vitest";
import { getAutonomousPolicyControlAction } from "./autonomousPolicyControl";

describe("autonomous policy control", () => {
  it("blocks autonomous work on profile evidence warnings", () => {
    const action = getAutonomousPolicyControlAction({
      plan: {
        summary: { eligible: 3, queuedForReview: 2 },
        policyWarnings: ["No resume is connected. Autonomous application records can be prepared, but submissions should not run."],
      },
      settings: { autonomousEnabled: true, requireHumanReview: true },
    });

    expect(action.status).toBe("blocked");
    expect(action.id).toBe("fix_profile");
    expect(action.route).toBe("/profile");
    expect(action.approvalGated).toBe(true);
  });

  it("routes review-gated autonomous work to the review queue", () => {
    const action = getAutonomousPolicyControlAction({
      plan: {
        summary: { eligible: 4, queuedForReview: 2 },
        policyWarnings: [],
      },
      settings: { autonomousEnabled: true, requireHumanReview: true },
    });

    expect(action.status).toBe("review_ready");
    expect(action.cta).toBe("Open review queue");
    expect(action.route).toBe("/review-queue");
    expect(action.risk).toBe("high");
  });

  it("routes connector evidence gates to profile setup before review work", () => {
    const action = getAutonomousPolicyControlAction({
      plan: {
        summary: { eligible: 4, queuedForReview: 2 },
        policyWarnings: [],
        evidenceGates: [{
          label: "Inbox response monitoring",
          detail: "Connect Gmail or Outlook before Hire.AI can automatically detect replies.",
          severity: "medium",
        }],
      },
      settings: { autonomousEnabled: true, requireHumanReview: true },
    });

    expect(action.status).toBe("blocked");
    expect(action.cta).toBe("Resolve evidence");
    expect(action.route).toBe("/profile");
    expect(action.risk).toBe("medium");
  });

  it("prioritizes high-severity evidence gates in action copy", () => {
    const action = getAutonomousPolicyControlAction({
      plan: {
        summary: { eligible: 4 },
        policyWarnings: [],
        evidenceGates: [
          { label: "Inbox response monitoring", detail: "Inbox setup is incomplete.", severity: "medium" },
          { label: "Evidence blocked", detail: "Core candidate evidence is missing.", severity: "high" },
        ],
      },
      settings: { autonomousEnabled: true, requireHumanReview: true },
    });

    expect(action.label).toBe("Evidence blocked");
    expect(action.detail).toBe("Core candidate evidence is missing.");
    expect(action.risk).toBe("high");
  });

  it("surfaces manual application handoffs before follow-up drafting", () => {
    const action = getAutonomousPolicyControlAction({
      plan: {
        summary: { eligible: 3, manualApply: 1, followUpsDue: 2 },
        policyWarnings: [],
      },
      settings: { autonomousEnabled: true, requireHumanReview: true },
    });

    expect(action.status).toBe("manual_ready");
    expect(action.route).toBe("/applications");
    expect(action.approvalGated).toBe(true);
  });

  it("surfaces follow-up drafting when no higher-priority job work is ready", () => {
    const action = getAutonomousPolicyControlAction({
      plan: {
        summary: { eligible: 0, followUpsDue: 2 },
        policyWarnings: [],
      },
      settings: { autonomousEnabled: true, requireHumanReview: true },
    });

    expect(action.status).toBe("follow_up_ready");
    expect(action.route).toBe("/applications");
    expect(action.detail).toContain("require review");
  });

  it("offers a manual run when eligible work exists but scheduling is disabled", () => {
    const action = getAutonomousPolicyControlAction({
      plan: {
        summary: { eligible: 5, dailyRemaining: 4 },
        policyWarnings: [],
      },
      settings: { autonomousEnabled: false, requireHumanReview: true },
    });

    expect(action.status).toBe("ready_to_run");
    expect(action.runsAgent).toBe(true);
    expect(action.cta).toBe("Run agent now");
  });

  it("reports scheduled background operation when scheduler and user setting are enabled", () => {
    const action = getAutonomousPolicyControlAction({
      plan: {
        summary: { eligible: 0, dailyRemaining: 4 },
        policyWarnings: [],
      },
      scheduler: {
        isStarted: true,
        userEnabled: true,
        nextCycleAt: "2026-07-01T09:00:00.000Z",
      },
      settings: { autonomousEnabled: true, requireHumanReview: true },
    });

    expect(action.status).toBe("scheduled");
    expect(action.runsAgent).toBe(false);
    expect(action.route).toBe("/jobs");
  });
});
