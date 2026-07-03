import { describe, expect, it } from "vitest";
import {
  getAutonomousEvidenceGateSummary,
  getAutonomousEvidenceGateSummaryText,
} from "./autonomousEvidenceGateSummary";

describe("autonomous evidence gate summary", () => {
  it("reports no active gates for empty plans", () => {
    expect(getAutonomousEvidenceGateSummary(null)).toMatchObject({
      total: 0,
      externalApplicationGated: false,
      followUpGated: false,
      replyMonitoringGated: false,
      documentDiscoveryGated: false,
    });
    expect(getAutonomousEvidenceGateSummaryText(null)).toBe("No active evidence gates");
  });

  it("summarizes severity and blocked automation surfaces", () => {
    const plan = {
      evidenceGates: [
        {
          severity: "high",
          blocks: ["external_application_submission", "follow_up_send"],
        },
        {
          severity: "medium",
          blocks: ["reply_monitoring", "document_discovery"],
        },
      ],
    };

    expect(getAutonomousEvidenceGateSummary(plan)).toMatchObject({
      total: 2,
      high: 1,
      medium: 1,
      externalApplicationGated: true,
      followUpGated: true,
      replyMonitoringGated: true,
      documentDiscoveryGated: true,
    });
    expect(getAutonomousEvidenceGateSummaryText(plan)).toBe(
      "2 evidence gates active: application submission, follow-up sending, reply monitoring, document discovery."
    );
  });
});
