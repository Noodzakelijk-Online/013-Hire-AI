import { describe, expect, it } from "vitest";
import { getCommandCenterSummary } from "./commandCenterSummary";
import type { SuccessFeeComplianceSummary } from "./successFeeCompliance";

const clearCompliance: SuccessFeeComplianceSummary = {
  status: "none",
  activeFees: 0,
  suspendedFees: 0,
  pausedFees: 0,
  disputedFees: 0,
  pendingVerification: 0,
  overdueVerifications: 0,
  dueSoonVerifications: 0,
  pendingOfferAttributions: 0,
  monthlyFeeCents: 0,
  nextVerificationDue: null,
  daysUntilNextVerification: null,
  label: "No active fees",
  nextAction: "Report a hire only after an offer is accepted.",
};

describe("command center summary", () => {
  it("prioritizes profile blockers before other work", () => {
    const summary = getCommandCenterSummary({
      readiness: {
        autoApplyEligible: false,
        blockers: [{ recommendation: "Upload a resume before approving submissions." }],
        warnings: [],
      },
      queues: {
        pendingApprovals: [{ id: 1 }],
      },
      metrics: {
        pendingApprovals: 1,
      },
    }, clearCompliance);

    expect(summary.status).toBe("blocked");
    expect(summary.primaryRoute).toBe("/profile");
    expect(summary.nextAction).toContain("Upload a resume");
    expect(summary.openActions).toBe(2);
  });

  it("surfaces consequential approvals before compliance work", () => {
    const compliance: SuccessFeeComplianceSummary = {
      ...clearCompliance,
      status: "needs_attention",
      pendingOfferAttributions: 1,
      label: "Needs attention",
      nextAction: "Review offer attribution.",
    };

    const summary = getCommandCenterSummary({
      readiness: {
        autoApplyEligible: true,
        blockers: [],
        warnings: [],
      },
      queues: {
        pendingApprovals: [{ id: 1 }, { id: 2 }],
      },
      metrics: {
        pendingApprovals: 2,
      },
    }, compliance);

    expect(summary.status).toBe("approval_required");
    expect(summary.headline).toContain("2 consequential actions");
    expect(summary.primaryRoute).toBe("/review-queue");
    expect(summary.complianceItems).toBe(1);
  });

  it("routes urgent success-fee compliance to billing", () => {
    const summary = getCommandCenterSummary({
      readiness: {
        autoApplyEligible: true,
        blockers: [],
        warnings: [],
      },
      queues: {},
      metrics: {},
    }, {
      ...clearCompliance,
      status: "needs_attention",
      overdueVerifications: 1,
      label: "Needs attention",
      nextAction: "Submit overdue employment verification proof.",
    });

    expect(summary.status).toBe("attention");
    expect(summary.label).toBe("Compliance attention");
    expect(summary.headline).toContain("Verification overdue");
    expect(summary.primaryCta).toBe("Submit verification");
    expect(summary.primaryRoute).toBe("/billing");
    expect(summary.openActions).toBe(1);
  });

  it("routes offer attribution compliance to the review queue", () => {
    const summary = getCommandCenterSummary({
      readiness: {
        autoApplyEligible: true,
        blockers: [],
        warnings: [],
      },
      queues: {},
      metrics: {},
    }, {
      ...clearCompliance,
      status: "needs_attention",
      pendingOfferAttributions: 1,
      label: "Needs attention",
      nextAction: "Review offer attribution.",
    });

    expect(summary.status).toBe("attention");
    expect(summary.label).toBe("Compliance attention");
    expect(summary.headline).toContain("Offer attribution review");
    expect(summary.primaryCta).toBe("Open review queue");
    expect(summary.primaryRoute).toBe("/review-queue");
    expect(summary.secondaryRoute).toBe("/billing");
    expect(summary.openActions).toBe(1);
  });

  it("prefers review queue items before follow-up drafting", () => {
    const summary = getCommandCenterSummary({
      readiness: {
        autoApplyEligible: true,
        blockers: [],
        warnings: [{ key: "salary" }],
      },
      queues: {
        reviewDecisions: [{ id: 1 }],
      },
      metrics: {
        reviewRequiredDecisions: 1,
        followUpsDue: 3,
      },
    }, clearCompliance);

    expect(summary.status).toBe("attention");
    expect(summary.label).toBe("Review queue");
    expect(summary.reviewItems).toBe(2);
    expect(summary.followUpsDue).toBe(3);
  });

  it("does not count admin review metrics for regular user ledgers", () => {
    const regularSummary = getCommandCenterSummary({
      canReviewAdminItems: false,
      readiness: {
        autoApplyEligible: true,
        blockers: [],
        warnings: [],
      },
      queues: {
        adminReviews: [{ id: 1 }],
      },
      metrics: {
        openAdminReviews: 1,
      },
    }, clearCompliance);

    const adminSummary = getCommandCenterSummary({
      canReviewAdminItems: true,
      readiness: {
        autoApplyEligible: true,
        blockers: [],
        warnings: [],
      },
      queues: {
        adminReviews: [{ id: 1 }],
      },
      metrics: {
        openAdminReviews: 1,
      },
    }, clearCompliance);

    expect(regularSummary.reviewItems).toBe(0);
    expect(regularSummary.status).toBe("clear");
    expect(adminSummary.reviewItems).toBe(1);
    expect(adminSummary.status).toBe("attention");
  });

  it("surfaces follow-ups when no higher-risk work is open", () => {
    const summary = getCommandCenterSummary({
      readiness: {
        autoApplyEligible: true,
        blockers: [],
        warnings: [],
      },
      queues: {},
      metrics: {
        followUpsDue: 2,
      },
    }, clearCompliance);

    expect(summary.status).toBe("attention");
    expect(summary.label).toBe("Follow-up due");
    expect(summary.primaryRoute).toBe("/applications");
  });

  it("surfaces connector readiness before routine follow-up drafting", () => {
    const summary = getCommandCenterSummary({
      readiness: {
        autoApplyEligible: true,
        blockers: [],
        warnings: [],
      },
      queues: {
        connectorReadiness: [{ id: "inbox-response-monitoring" }],
      },
      metrics: {
        connectorReadiness: 1,
        followUpsDue: 2,
      },
    }, clearCompliance);

    expect(summary.status).toBe("attention");
    expect(summary.label).toBe("Connector readiness");
    expect(summary.connectorReadiness).toBe(1);
    expect(summary.followUpsDue).toBe(2);
    expect(summary.openActions).toBe(3);
    expect(summary.primaryRoute).toBe("/profile");
  });

  it("surfaces approved send handoffs before new follow-up drafting", () => {
    const summary = getCommandCenterSummary({
      readiness: {
        autoApplyEligible: true,
        blockers: [],
        warnings: [],
      },
      queues: {
        approvedFollowUpsReadyToSend: [{ followUpId: 1 }],
      },
      metrics: {
        approvedFollowUpsReadyToSend: 1,
        followUpsDue: 2,
      },
    }, clearCompliance);

    expect(summary.status).toBe("attention");
    expect(summary.label).toBe("Send handoff");
    expect(summary.approvedFollowUpsReadyToSend).toBe(1);
    expect(summary.followUpsDue).toBe(2);
    expect(summary.openActions).toBe(3);
    expect(summary.primaryRoute).toBe("/review-queue");
  });

  it("surfaces interview scheduling before follow-up drafting", () => {
    const summary = getCommandCenterSummary({
      readiness: {
        autoApplyEligible: true,
        blockers: [],
        warnings: [],
      },
      queues: {
        interviewScheduling: [{ applicationId: 1 }],
      },
      metrics: {
        interviewSchedulingNeeded: 1,
        followUpsDue: 2,
      },
    }, clearCompliance);

    expect(summary.status).toBe("attention");
    expect(summary.label).toBe("Interview scheduling");
    expect(summary.interviewSchedulingNeeded).toBe(1);
    expect(summary.followUpsDue).toBe(2);
    expect(summary.openActions).toBe(3);
    expect(summary.primaryRoute).toBe("/review-queue");
  });

  it("surfaces a verified interview notification before scheduling and routine follow-ups", () => {
    const summary = getCommandCenterSummary({
      readiness: {
        autoApplyEligible: true,
        blockers: [],
        warnings: [],
      },
      queues: {
        interviewScheduling: [{ applicationId: 1 }],
      },
      metrics: {
        unreadInterviewNotifications: 1,
        interviewSchedulingNeeded: 1,
        followUpsDue: 2,
      },
    }, clearCompliance);

    expect(summary.status).toBe("attention");
    expect(summary.label).toBe("Interview invite");
    expect(summary.unreadInterviewNotifications).toBe(1);
    expect(summary.interviewSchedulingNeeded).toBe(1);
    expect(summary.followUpsDue).toBe(2);
    expect(summary.openActions).toBe(4);
    expect(summary.primaryRoute).toBe("/dashboard");
  });

  it("surfaces interview preparation before employer replies and follow-up drafting", () => {
    const summary = getCommandCenterSummary({
      readiness: {
        autoApplyEligible: true,
        blockers: [],
        warnings: [],
      },
      queues: {
        interviewPreparationNeeded: [{ applicationId: 1 }],
        employerResponsesNeedingReply: [{ applicationId: 2 }],
      },
      metrics: {
        interviewPreparationNeeded: 1,
        employerResponsesNeedingReply: 1,
        followUpsDue: 2,
      },
    }, clearCompliance);

    expect(summary.status).toBe("attention");
    expect(summary.label).toBe("Interview prep");
    expect(summary.interviewPreparationNeeded).toBe(1);
    expect(summary.employerResponsesNeedingReply).toBe(1);
    expect(summary.openActions).toBe(4);
    expect(summary.primaryRoute).toBe("/review-queue");
  });

  it("surfaces employer replies before routine follow-up drafting", () => {
    const summary = getCommandCenterSummary({
      readiness: {
        autoApplyEligible: true,
        blockers: [],
        warnings: [],
      },
      queues: {
        employerResponsesNeedingReply: [{ applicationId: 1 }],
      },
      metrics: {
        employerResponsesNeedingReply: 1,
        followUpsDue: 2,
      },
    }, clearCompliance);

    expect(summary.status).toBe("attention");
    expect(summary.label).toBe("Employer reply");
    expect(summary.employerResponsesNeedingReply).toBe(1);
    expect(summary.followUpsDue).toBe(2);
    expect(summary.openActions).toBe(3);
    expect(summary.primaryRoute).toBe("/review-queue");
  });

  it("reports ready prepared applications before clear state", () => {
    const summary = getCommandCenterSummary({
      readiness: {
        autoApplyEligible: true,
        blockers: [],
        warnings: [],
      },
      queues: {},
      metrics: {
        preparedApplications: 1,
        dailyRemaining: 4,
      },
    }, clearCompliance);

    expect(summary.status).toBe("ready");
    expect(summary.label).toBe("Prepared work");
    expect(summary.primaryRoute).toBe("/applications");
  });

  it("reports clear state when there are no open actions", () => {
    const summary = getCommandCenterSummary({
      readiness: {
        autoApplyEligible: true,
        blockers: [],
        warnings: [],
      },
      queues: {},
      metrics: {
        dailyRemaining: 5,
      },
    }, clearCompliance);

    expect(summary.status).toBe("clear");
    expect(summary.openActions).toBe(0);
    expect(summary.primaryCta).toBe("Review Matches");
    expect(summary.primaryRoute).toBe("/jobs");
  });

  it("blocks on uncertain mailbox delivery before approved handoffs or new follow-ups", () => {
    const summary = getCommandCenterSummary({
      readiness: {
        autoApplyEligible: true,
        blockers: [],
        warnings: [],
      },
      queues: {
        followUpDeliveryReconciliation: [{ followUpId: 1 }],
        approvedFollowUpsReadyToSend: [{ followUpId: 2 }],
      },
      metrics: {
        followUpDeliveryReconciliation: 1,
        approvedFollowUpsReadyToSend: 1,
        followUpsDue: 2,
      },
    }, clearCompliance);

    expect(summary.status).toBe("blocked");
    expect(summary.label).toBe("Delivery verification");
    expect(summary.followUpDeliveryReconciliation).toBe(1);
    expect(summary.openActions).toBe(4);
    expect(summary.primaryRoute).toBe("/review-queue");
  });

  it("uses the dashboard route for verified interview navigation", () => {
    const summary = getCommandCenterSummary({
      readiness: {
        autoApplyEligible: true,
        blockers: [],
        warnings: [],
      },
      queues: {},
      metrics: {
        unreadInterviewNotifications: 1,
      },
    }, clearCompliance);

    expect(summary.primaryCta).toBe("Open Dashboard");
    expect(summary.primaryRoute).toBe("/dashboard");
  });
});
