import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import { createApplication, getAuditEventsForUser, getUserApplications } from "./db";

function createContext(userId: number): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `application-status-control-${userId}`,
      email: `application-status-control-${userId}@example.local`,
      name: "Application Status Control User",
      loginMethod: "test",
      role: "user",
      accountStatus: "active",
      tosAcceptedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("application status controls", () => {
  it("reserves generic status updates for user withdrawal", async () => {
    const userId = 99301;
    const application = await createApplication({ userId, jobId: 1, status: "applied" });
    const applicationId = Number(application.insertId);
    const caller = appRouter.createCaller(createContext(userId));

    await expect(caller.applications.updateStatus({
      applicationId,
      status: "offer" as never,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect((await getUserApplications(userId)).find((item) => item.id === applicationId)?.status).toBe("applied");

    await caller.applications.updateStatus({ applicationId, status: "withdrawn" });
    expect((await getUserApplications(userId)).find((item) => item.id === applicationId)?.status).toBe("withdrawn");

    const audit = (await getAuditEventsForUser(userId, 10)).find((event) =>
      event.entityId === applicationId && event.action === "application_status_updated"
    );
    expect(audit?.riskLevel).toBe("medium");
    expect(audit?.afterState).toContain('"withdrawn"');
  });

  it("requires explicit confirmation and creates a high-risk audit event to accept an offer", async () => {
    const userId = 99302;
    const application = await createApplication({ userId, jobId: 2, status: "offer" });
    const applicationId = Number(application.insertId);
    const caller = appRouter.createCaller(createContext(userId));

    await expect(caller.applications.updateStatus({
      applicationId,
      status: "accepted" as never,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await expect(caller.applications.confirmOfferAcceptance({
      applicationId,
      confirmed: false as never,
      acceptanceNote: "I accepted the employer's written offer.",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect((await getUserApplications(userId)).find((item) => item.id === applicationId)?.status).toBe("offer");

    await expect(caller.applications.confirmOfferAcceptance({
      applicationId,
      confirmed: true,
      acceptanceNote: "I accepted the employer's written offer.",
    })).resolves.toEqual({ success: true });

    expect((await getUserApplications(userId)).find((item) => item.id === applicationId)?.status).toBe("accepted");

    const audit = (await getAuditEventsForUser(userId, 10)).find((event) =>
      event.entityId === applicationId && event.action === "offer_acceptance_confirmed"
    );
    expect(audit).toMatchObject({
      actor: "user",
      source: "applications.confirmOfferAcceptance",
      riskLevel: "high",
    });
    expect(audit?.beforeState).toContain('"offer"');
    expect(audit?.afterState).toContain('"accepted"');
  });
});
