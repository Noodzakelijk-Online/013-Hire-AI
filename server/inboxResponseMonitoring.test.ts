import { describe, expect, it, vi } from "vitest";
import { monitorInboxResponses } from "./inboxResponseMonitoring";

const candidate = {
  provider: "gmail" as const,
  messageId: "message-701",
  applicationId: 701,
  company: "Acme Analytics",
  jobTitle: "Senior Data Engineer",
  sender: "recruiter@acme.example",
  subject: "Interview request",
  preview: "We would like to schedule an interview.",
  receivedAt: "2026-07-13T12:00:00.000Z",
  suggestedResponseType: "interview_invite" as const,
  confidence: "high" as const,
};

function dependencies() {
  return {
    createAuditEvent: vi.fn().mockResolvedValue({ insertId: 1 }),
    listUserConnectorAccounts: vi.fn().mockResolvedValue([{
      provider: "gmail",
      status: "connected",
      consentScopes: JSON.stringify(["email.messages.read_recruiting"]),
    }]),
    upsertInboxResponseCandidate: vi.fn().mockResolvedValue({ existing: false }),
    discoverInboxResponseCandidates: vi.fn().mockResolvedValue([candidate]),
  } as any;
}

describe("inbox response monitoring", () => {
  it("persists consented inbox matches as review candidates without recording an employer response", async () => {
    const mocks = dependencies();

    await expect(monitorInboxResponses(701, { dependencies: mocks })).resolves.toEqual({
      providersScanned: 1,
      candidatesDiscovered: 1,
      monitoringFailures: 0,
      errors: [],
    });
    expect(mocks.upsertInboxResponseCandidate).toHaveBeenCalledWith(expect.objectContaining({
      userId: 701,
      applicationId: 701,
      messageId: "message-701",
      suggestedResponseType: "interview_invite",
    }));
    expect(mocks.createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: "inbox_response_monitoring_scanned",
      actor: "system",
      source: "autonomousService",
    }));
  });

  it("does not read a provider unless recruiting-message consent is granted", async () => {
    const mocks = dependencies();
    mocks.listUserConnectorAccounts.mockResolvedValue([{
      provider: "gmail",
      status: "connected",
      consentScopes: JSON.stringify([]),
    }]);

    await expect(monitorInboxResponses(701, { dependencies: mocks })).resolves.toMatchObject({
      providersScanned: 0,
      candidatesDiscovered: 0,
    });
    expect(mocks.discoverInboxResponseCandidates).not.toHaveBeenCalled();
    expect(mocks.createAuditEvent).not.toHaveBeenCalled();
  });

  it("records provider failures without turning them into an automatic application update", async () => {
    const mocks = dependencies();
    mocks.discoverInboxResponseCandidates.mockRejectedValue(new Error("Gmail authorization is no longer valid."));

    await expect(monitorInboxResponses(701, { dependencies: mocks })).resolves.toMatchObject({
      providersScanned: 0,
      candidatesDiscovered: 0,
      monitoringFailures: 1,
      errors: ["gmail: Gmail authorization is no longer valid."],
    });
    expect(mocks.createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: "inbox_response_monitoring_failed",
      riskLevel: "medium",
    }));
  });
});
