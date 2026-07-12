import { describe, expect, it } from "vitest";
import {
  buildAutonomousEvidenceGates,
  countEvidenceGatedActions,
} from "./autonomousEvidenceGates";
import type { ProfileEvidenceControlSummary } from "./profileEvidence";

const profileEvidence: ProfileEvidenceControlSummary = {
  status: "blocked",
  label: "Evidence blocked",
  headline: "Profile evidence is not ready for autonomous preparation.",
  detail: "Add the core resume, skills, and experience evidence before any external application workflow can advance.",
  cta: "Fix profile evidence",
  primarySection: "import",
  score: 35,
  connectedCount: 0,
  missingCount: 4,
  consentRequiredCount: 4,
  autoApplyEligible: false,
  externalAccessGated: true,
  providers: [],
};

describe("autonomous evidence gates", () => {
  it("blocks external submissions and follow-up sends when core profile evidence is blocked", () => {
    const gates = buildAutonomousEvidenceGates({ profileEvidence });

    expect(gates[0]).toMatchObject({
      id: "profile-core-evidence",
      severity: "high",
      blocks: ["external_application_submission", "follow_up_send"],
    });
    expect(countEvidenceGatedActions({
      gates,
      applicationSubmissionCandidates: 2,
      followUpSendCandidates: 3,
    })).toEqual({
      applicationSubmissionsBlocked: 2,
      followUpsBlocked: 3,
      total: 5,
    });
  });

  it("turns connector readiness into targeted evidence gates", () => {
    const gates = buildAutonomousEvidenceGates({
      connectorReadiness: [
        {
          id: "inbox-response-monitoring",
          label: "Inbox response monitoring",
          detail: "Connect Gmail or Outlook before Hire.AI can automatically detect replies.",
          providerIds: ["gmail", "outlook"],
          riskLevel: "medium",
          affectedApplications: 4,
        },
        {
          id: "cloud-resume-discovery",
          label: "Cloud resume discovery",
          detail: "Connect Google Drive or Dropbox, or upload a resume.",
          providerIds: ["google_drive", "dropbox"],
          riskLevel: "medium",
        },
      ],
    });

    expect(gates).toHaveLength(2);
    expect(gates[0]).toMatchObject({
      id: "connector-inbox-response-monitoring",
      blocks: ["reply_monitoring", "follow_up_send"],
      affectedApplications: 4,
    });
    expect(gates[1]).toMatchObject({
      id: "connector-cloud-resume-discovery",
      blocks: ["document_discovery"],
    });
  });

  it("does not turn optional external-provider consent into a submission block", () => {
    const gates = buildAutonomousEvidenceGates({
      profileEvidence: {
        ...profileEvidence,
        status: "limited",
        label: "Evidence limited",
        externalAccessGated: true,
        blockers: [],
        autoApplyEligible: true,
      },
    });

    expect(gates).toEqual([]);
  });
});
