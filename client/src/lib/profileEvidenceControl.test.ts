import { describe, expect, it } from "vitest";
import { getProfileEvidenceControlSummary } from "./profileEvidenceControl";

describe("profile evidence control", () => {
  it("blocks autonomous preparation when resume or readiness evidence is missing", () => {
    const summary = getProfileEvidenceControlSummary({
      profile: {},
      readiness: {
        score: 38,
        autoApplyEligible: false,
        blockers: [{ key: "resume" }],
        warnings: [],
      },
    });

    expect(summary.status).toBe("blocked");
    expect(summary.primarySection).toBe("import");
    expect(summary.externalAccessGated).toBe(true);
    expect(summary.providers.find((provider) => provider.id === "resume")?.status).toBe("missing");
    expect(summary.providers.find((provider) => provider.id === "gmail")?.status).toBe("consent_required");
  });

  it("treats saved resume and professional links as usable evidence", () => {
    const summary = getProfileEvidenceControlSummary({
      profile: {
        resumeFileKey: "resumes/1/current.pdf",
        linkedinUrl: "https://linkedin.com/in/example",
        githubUrl: "https://github.com/example",
        portfolioUrl: "https://example.com",
      },
      readiness: {
        score: 87,
        autoApplyEligible: true,
        blockers: [],
        warnings: [],
      },
    });

    expect(summary.connectedCount).toBe(4);
    expect(summary.missingCount).toBe(0);
    expect(summary.consentRequiredCount).toBe(4);
    expect(summary.status).toBe("limited");
    expect(summary.headline).toContain("external sources");
  });

  it("routes limited evidence work to social links when profile proof is incomplete", () => {
    const summary = getProfileEvidenceControlSummary({
      profile: {
        resumeUrl: "https://cdn.example.com/resume.pdf",
      },
      readiness: {
        score: 76,
        autoApplyEligible: true,
        blockers: [],
        warnings: [],
      },
    });

    expect(summary.status).toBe("limited");
    expect(summary.primarySection).toBe("social");
    expect(summary.missingCount).toBe(3);
  });

  it("tracks requested and authorized connector state without treating requests as access", () => {
    const summary = getProfileEvidenceControlSummary({
      profile: {
        resumeFileKey: "resumes/1/current.pdf",
        linkedinUrl: "https://linkedin.com/in/example",
        githubUrl: "https://github.com/example",
        portfolioUrl: "https://example.com",
      },
      readiness: {
        score: 94,
        autoApplyEligible: true,
        blockers: [],
        warnings: [],
      },
      connectorAccounts: [
        {
          provider: "gmail",
          status: "connection_requested",
          consentScopes: ["email.metadata.read", "email.messages.read_recruiting"],
        },
        {
          provider: "google_drive",
          status: "connected",
          externalAccountLabel: "candidate-drive@example.com",
          consentScopes: "[\"files.metadata.read\"]",
        },
      ],
    });

    const gmail = summary.providers.find((provider) => provider.id === "gmail");
    const googleDrive = summary.providers.find((provider) => provider.id === "google_drive");

    expect(gmail?.status).toBe("consent_required");
    expect(gmail?.connectionStatus).toBe("connection_requested");
    expect(gmail?.consentScopes).toContain("email.messages.read_recruiting");
    expect(googleDrive?.status).toBe("connected");
    expect(googleDrive?.connectionStatus).toBe("connected");
    expect(googleDrive?.accountLabel).toBe("candidate-drive@example.com");
    expect(summary.connectedCount).toBe(5);
    expect(summary.consentRequiredCount).toBe(3);
  });

  it("tracks professional profile connector requests without treating them as imported evidence", () => {
    const summary = getProfileEvidenceControlSummary({
      profile: {
        resumeFileKey: "resumes/1/current.pdf",
      },
      readiness: {
        score: 78,
        autoApplyEligible: true,
        blockers: [],
        warnings: [],
      },
      connectorAccounts: [
        {
          provider: "linkedin",
          status: "connection_requested",
          consentScopes: ["profile.basic.read"],
        },
        {
          provider: "github",
          status: "needs_reauth",
          externalAccountLabel: "candidate-github",
          consentScopes: ["profile.basic.read", "repositories.metadata.read"],
        },
      ],
    });

    const linkedIn = summary.providers.find((provider) => provider.id === "linkedin");
    const github = summary.providers.find((provider) => provider.id === "github");

    expect(linkedIn?.status).toBe("consent_required");
    expect(linkedIn?.connectionStatus).toBe("connection_requested");
    expect(linkedIn?.consentScopes).toContain("profile.basic.read");
    expect(github?.status).toBe("consent_required");
    expect(github?.connectionStatus).toBe("needs_reauth");
    expect(github?.accountLabel).toBe("candidate-github");
    expect(summary.missingCount).toBe(1);
    expect(summary.consentRequiredCount).toBe(6);
  });
});
