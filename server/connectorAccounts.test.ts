import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { createApplication, getAuditEventsForUser, getEmployerResponses, listPendingInboxResponseCandidates, listUnreadInterviewNotifications, listUserConnectorAccounts, upsertInboxResponseCandidate, upsertUserConnectorAccount, upsertUserProfile } from "./db";
import { appRouter } from "./routers";

function createContext(userId: number): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `connector-account-${userId}`,
      name: "Connector Account User",
      email: `connector-account-${userId}@example.local`,
      loginMethod: "test",
      role: "user",
      stripeCustomerId: null,
      accountStatus: "active",
      tosAcceptedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("connector account tRPC procedures", () => {
  it("ingests a connected inbox response once and records connector provenance", async () => {
    const userId = 99652;
    const application = await createApplication({
      userId,
      jobId: 2,
      status: "applied",
      notes: "Submitted application awaiting an email response.",
    });
    const applicationId = Number(application.insertId);
    await upsertUserConnectorAccount({
      userId,
      provider: "gmail",
      status: "connected",
      consentScopes: JSON.stringify(["email.metadata.read", "email.messages.read_recruiting"]),
      externalAccountLabel: "candidate@example.com",
      lastVerifiedAt: new Date(),
    });

    const caller = appRouter.createCaller(createContext(userId));
    const input = {
      applicationId,
      provider: "gmail" as const,
      messageId: "gmail-message-99652",
      responseType: "interview_invite" as const,
      summary: "Recruiter invited the candidate to a first interview next week.",
    };
    const first = await caller.applications.ingestInboxResponse(input);
    const second = await caller.applications.ingestInboxResponse(input);

    expect(first.existing).toBe(false);
    expect(second.existing).toBe(true);
    expect((await getEmployerResponses(applicationId, userId))).toHaveLength(1);
    expect((await getAuditEventsForUser(userId, 20)).filter((event) => event.action === "inbox_response_ingested")).toHaveLength(1);
  });

  it("consumes a persisted inbox candidate only after the user confirms its classification", async () => {
    const userId = 99657;
    const application = await createApplication({
      userId,
      jobId: 3,
      status: "applied",
      notes: "Awaiting an application-linked inbox response.",
    });
    const applicationId = Number(application.insertId);
    await upsertUserConnectorAccount({
      userId,
      provider: "outlook",
      status: "connected",
      consentScopes: JSON.stringify(["mail.messages.read_recruiting"]),
      externalAccountLabel: "candidate@example.com",
      lastVerifiedAt: new Date(),
    });
    await upsertInboxResponseCandidate({
      userId,
      applicationId,
      provider: "outlook",
      messageId: "outlook-candidate-99657",
      sender: "recruiter@example.com",
      subject: "Interview invitation",
      preview: "We would like to arrange a conversation about your application.",
      receivedAt: new Date(),
      suggestedResponseType: "interview_invite",
      confidence: "high",
    });

    const caller = appRouter.createCaller(createContext(userId));
    expect(await caller.applications.listInboxResponseCandidates()).toHaveLength(1);
    expect(await listUnreadInterviewNotifications(userId)).toHaveLength(0);

    await caller.applications.ingestInboxResponse({
      applicationId,
      provider: "outlook",
      messageId: "outlook-candidate-99657",
      responseType: "interview_invite",
      summary: "We would like to arrange a conversation about your application.",
    });

    expect(await listPendingInboxResponseCandidates(userId)).toEqual([]);
    expect(await getEmployerResponses(applicationId, userId)).toHaveLength(1);
    expect(await listUnreadInterviewNotifications(userId)).toHaveLength(1);
  });

  it("records connector intent, feeds evidence readiness, and audits without tokens", async () => {
    const userId = 99651;
    await upsertUserProfile({
      userId,
      skills: "TypeScript, React, Node.js",
      experience: "Built remote SaaS products for five years.",
      education: "BSc Computer Science",
      desiredJobTypes: "Full Stack Engineer",
      desiredLocations: "Remote",
      salaryExpectationMin: 90000,
      salaryExpectationMax: 140000,
      resumeFileKey: "resumes/99651/resume.pdf",
      linkedinUrl: "https://linkedin.com/in/connector-example",
      githubUrl: "https://github.com/connector-example",
      portfolioUrl: "https://connector.example.com",
    });

    const caller = appRouter.createCaller(createContext(userId));
    const requestResult = await caller.connectors.requestConnection({
      provider: "gmail",
    });

    expect(requestResult.success).toBe(true);
    expect(requestResult.requiresOAuth).toBe(true);
    expect(requestResult.account.status).toBe("connection_requested");
    expect(requestResult.account.provider).toBe("gmail");
    expect(JSON.stringify(requestResult)).not.toContain("accessToken");

    const linkedInRequest = await caller.connectors.requestConnection({
      provider: "linkedin",
    });
    expect(linkedInRequest.account.provider).toBe("linkedin");
    expect(linkedInRequest.account.status).toBe("connection_requested");

    const summary = await caller.profile.getEvidenceReadiness();
    const gmail = summary.providers.find((provider) => provider.id === "gmail");
    const linkedIn = summary.providers.find((provider) => provider.id === "linkedin");
    expect(gmail?.status).toBe("consent_required");
    expect(gmail?.connectionStatus).toBe("connection_requested");
    expect(gmail?.consentScopes).toContain("email.messages.read_recruiting");
    expect(linkedIn?.status).toBe("connected");
    expect(linkedIn?.connectionStatus).toBe("connection_requested");
    expect(linkedIn?.consentScopes).toContain("profile.basic.read");

    const auditEvents = await caller.audit.getForEntity({
      entityType: "user",
      entityId: userId,
    });
    expect(auditEvents.some((event) => event.action === "connector_connection_requested")).toBe(true);
    expect(auditEvents.filter((event) => event.action === "connector_connection_requested")).toHaveLength(2);
    expect(JSON.stringify(auditEvents)).not.toContain("accessToken");

    const disconnectResult = await caller.connectors.disconnect({
      provider: "gmail",
    });
    expect(disconnectResult.success).toBe(true);
    expect(disconnectResult.account.status).toBe("disabled");
  });

  it("allows the explicit follow-up send scope but rejects scopes outside Hire.AI's inventory", async () => {
    const userId = 99653;
    const caller = appRouter.createCaller(createContext(userId));

    const result = await caller.connectors.requestConnection({
      provider: "gmail",
      consentScopes: [
        "email.metadata.read",
        "email.messages.read_recruiting",
        "email.messages.send",
      ],
    });
    expect(result.account.consentScopes).toContain("email.messages.send");

    await expect(caller.connectors.requestConnection({
      provider: "gmail",
      consentScopes: ["mail.send.everything"],
    })).rejects.toThrow(/not permitted/i);
  });

  it("fails closed when a deployment has not provisioned OAuth credentials", async () => {
    const userId = 99656;
    const caller = appRouter.createCaller(createContext(userId));

    await expect(caller.connectors.startOAuth({ provider: "gmail" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "gmail OAuth is not configured for this deployment.",
    });

    expect(await listUserConnectorAccounts(userId)).toHaveLength(0);
    expect((await getAuditEventsForUser(userId, 10)).some((event) =>
      event.action === "connector_oauth_started"
    )).toBe(false);
  });

  it("requires renewed connector verification before stale inbox evidence is ingested", async () => {
    const userId = 99654;
    const application = await createApplication({
      userId,
      jobId: 1,
      status: "applied",
      notes: "Application awaiting an inbox response from an old connection.",
    });
    await upsertUserConnectorAccount({
      userId,
      provider: "gmail",
      status: "connected",
      consentScopes: JSON.stringify(["email.metadata.read", "email.messages.read_recruiting"]),
      externalAccountLabel: "candidate@example.com",
      lastVerifiedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
    });

    const caller = appRouter.createCaller(createContext(userId));
    await expect(caller.applications.ingestInboxResponse({
      applicationId: Number(application.insertId),
      provider: "gmail",
      messageId: "gmail-stale-99654",
      responseType: "interview_invite",
      summary: "Recruiter invited the candidate to an interview through a stale connection.",
    })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Gmail must be currently verified with recruiting-message read consent before inbox responses can be ingested.",
    });

    const summary = await caller.profile.getEvidenceReadiness();
    expect(summary.providers.find((provider) => provider.id === "gmail")).toMatchObject({
      status: "consent_required",
      connectionStatus: "needs_reauth",
      authorizationStale: true,
    });
    expect(await getEmployerResponses(Number(application.insertId), userId)).toHaveLength(0);
  });

  it("treats a connected account without verification evidence as needing reauthorization", async () => {
    const userId = 99655;
    const application = await createApplication({
      userId,
      jobId: 1,
      status: "applied",
      notes: "Application awaiting a response from an unverified legacy connection.",
    });
    await upsertUserConnectorAccount({
      userId,
      provider: "gmail",
      status: "connected",
      consentScopes: JSON.stringify(["email.metadata.read", "email.messages.read_recruiting"]),
      externalAccountLabel: "candidate@example.com",
      lastVerifiedAt: null,
    });

    const caller = appRouter.createCaller(createContext(userId));
    await expect(caller.applications.ingestInboxResponse({
      applicationId: Number(application.insertId),
      provider: "gmail",
      messageId: "gmail-unverified-99655",
      responseType: "interview_invite",
      summary: "Recruiter invited the candidate to an interview through an unverified connection.",
    })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Gmail must be currently verified with recruiting-message read consent before inbox responses can be ingested.",
    });

    const summary = await caller.profile.getEvidenceReadiness();
    expect(summary.providers.find((provider) => provider.id === "gmail")).toMatchObject({
      status: "consent_required",
      connectionStatus: "needs_reauth",
      authorizationStale: true,
    });
    expect(await getEmployerResponses(Number(application.insertId), userId)).toHaveLength(0);
  });
});
