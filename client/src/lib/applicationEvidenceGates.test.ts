import { describe, expect, it } from "vitest";
import { getApplicationEvidenceGateSummary } from "./applicationEvidenceGates";

const gates = [
  {
    id: "profile-core-evidence",
    label: "Evidence blocked",
    detail: "Add resume evidence before applications can advance.",
    severity: "high",
    route: "/profile",
    blocks: ["external_application_submission", "follow_up_send"],
  },
  {
    id: "inbox-response-monitoring",
    label: "Inbox response monitoring",
    detail: "Connect Gmail or Outlook before reply monitoring.",
    severity: "medium",
    route: "/profile",
    blocks: ["reply_monitoring", "follow_up_send"],
    affectedApplications: 3,
  },
  {
    id: "cloud-resume-discovery",
    label: "Cloud resume discovery",
    detail: "Connect cloud storage before document discovery.",
    severity: "medium",
    route: "/profile",
    blocks: ["document_discovery"],
  },
];

describe("application evidence gates", () => {
  it("matches pending applications to submission and document evidence gates", () => {
    const summary = getApplicationEvidenceGateSummary({ status: "pending" }, gates);

    expect(summary.count).toBe(2);
    expect(summary.highestSeverity).toBe("high");
    expect(summary.blockedCapabilities).toEqual(
      expect.arrayContaining(["external application submission", "document discovery"])
    );
  });

  it("matches active applications to follow-up and reply monitoring gates", () => {
    const summary = getApplicationEvidenceGateSummary({ status: "applied" }, gates);

    expect(summary.count).toBe(2);
    expect(summary.blockedCapabilities).toEqual(
      expect.arrayContaining(["follow up send", "reply monitoring"])
    );
  });

  it("does not block closed applications with external action gates", () => {
    const summary = getApplicationEvidenceGateSummary({ status: "withdrawn" }, gates);

    expect(summary.count).toBe(0);
    expect(summary.headline).toBe("No evidence gates block this application.");
  });
});
