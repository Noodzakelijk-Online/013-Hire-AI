import { describe, expect, it } from "vitest";
import { getApplicationPipelineControlSummary } from "./applicationPipelineControl";

describe("application pipeline control summary", () => {
  it("reports empty state with no tracked applications", () => {
    const summary = getApplicationPipelineControlSummary([], []);

    expect(summary.status).toBe("empty");
    expect(summary.trackedApplications).toBe(0);
    expect(summary.primaryTab).toBe("all");
  });

  it("prioritizes blocking application submission approvals", () => {
    const summary = getApplicationPipelineControlSummary(
      [
        { id: 10, status: "pending" },
        { id: 11, status: "offer" },
      ],
      [{
        applicationId: 10,
        approvalType: "application_submission",
        status: "pending",
      }]
    );

    expect(summary.status).toBe("approval_blocked");
    expect(summary.approvalBlocked).toBe(1);
    expect(summary.offerActions).toBe(1);
    expect(summary.primaryTab).toBe("active");
  });

  it("does not block the active pipeline with approvals from closed applications", () => {
    const summary = getApplicationPipelineControlSummary(
      [
        { id: 10, status: "withdrawn" },
        { id: 11, status: "applied" },
      ],
      [{
        applicationId: 10,
        approvalType: "application_submission",
        status: "cancelled",
      }]
    );

    expect(summary.status).toBe("follow_up_candidate");
    expect(summary.approvalBlocked).toBe(0);
    expect(summary.closedApplications).toBe(1);
  });

  it("flags prepared applications that still need submission evidence", () => {
    const summary = getApplicationPipelineControlSummary(
      [
        { id: 10, status: "pending" },
        { id: 11, status: "applied" },
      ],
      [{
        applicationId: 10,
        approvalType: "application_submission",
        status: "approved",
      }]
    );

    expect(summary.status).toBe("evidence_needed");
    expect(summary.preparedApplications).toBe(1);
    expect(summary.evidenceNeeded).toBe(1);
  });

  it("routes offers to attribution review when no approval or evidence is blocking", () => {
    const summary = getApplicationPipelineControlSummary(
      [
        { id: 10, status: "offer" },
        { id: 11, status: "applied" },
      ],
      []
    );

    expect(summary.status).toBe("offer_action");
    expect(summary.offerActions).toBe(1);
    expect(summary.primaryTab).toBe("offered");
  });

  it("surfaces employer response activity before generic follow-up candidates", () => {
    const summary = getApplicationPipelineControlSummary(
      [
        { id: 10, status: "viewed" },
        { id: 11, status: "applied" },
      ],
      []
    );

    expect(summary.status).toBe("response_active");
    expect(summary.responseActive).toBe(1);
    expect(summary.followUpCandidates).toBe(2);
  });

  it("identifies follow-up candidates when no responses are active", () => {
    const summary = getApplicationPipelineControlSummary(
      [
        { id: 10, status: "applied" },
        { id: 11, status: "withdrawn" },
      ],
      []
    );

    expect(summary.status).toBe("follow_up_candidate");
    expect(summary.followUpCandidates).toBe(1);
    expect(summary.closedApplications).toBe(1);
  });

  it("reports clear state for closed-only historical ledger", () => {
    const summary = getApplicationPipelineControlSummary(
      [
        { id: 10, status: "rejected" },
        { id: 11, status: "withdrawn" },
      ],
      []
    );

    expect(summary.status).toBe("clear");
    expect(summary.closedApplications).toBe(2);
    expect(summary.primaryTab).toBe("all");
  });
});
