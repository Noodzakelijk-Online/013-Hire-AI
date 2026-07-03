import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { upsertUserProfile } from "./db";
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
});
