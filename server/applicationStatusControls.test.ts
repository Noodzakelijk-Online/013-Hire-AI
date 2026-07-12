import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import { createApplication, getApplicationLedgerArtifacts, getAuditEventsForUser, getUserApplications, listUserApplicationApprovals, resolveApplicationApproval, updateApplicationStatus } from "./db";
import { createFollowUp, getInterviewSchedules, getUpcomingInterviews, markFollowUpSent, scheduleInterview } from "./applicationFeatures";

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

  it("retires stale internal follow-ups and interviews when an offer is accepted", async () => {
    const userId = 99303;
    const application = await createApplication({ userId, jobId: 2, status: "interview" });
    const applicationId = Number(application.insertId);
    const followUp = await createFollowUp({
      applicationId,
      message: "I wanted to confirm the next step for this application.",
    }, userId);
    const followUpApproval = (await listUserApplicationApprovals(userId, "pending")).find((approval) =>
      approval.entityType === "follow_up" && approval.entityId === followUp.id
    );
    expect(followUpApproval).toBeTruthy();
    await resolveApplicationApproval(
      followUpApproval!.id,
      userId,
      "approved",
      "Approved before the employer's offer was accepted.",
      "user"
    );
    const interview = await scheduleInterview({
      applicationId,
      interviewType: "video",
      scheduledAt: new Date(Date.now() + 3 * 86400000),
    }, userId);
    await updateApplicationStatus(applicationId, "offer", userId);

    const caller = appRouter.createCaller(createContext(userId));
    await caller.applications.confirmOfferAcceptance({
      applicationId,
      confirmed: true,
      acceptanceNote: "I accepted the employer's written offer today.",
    });

    expect((await getUserApplications(userId)).find((item) => item.id === applicationId)?.status).toBe("accepted");
    expect((await listUserApplicationApprovals(userId, "all")).find((approval) => approval.id === followUpApproval!.id)?.status).toBe("cancelled");
    await expect(markFollowUpSent(followUp.id, userId)).rejects.toThrow("Follow-ups can only be created after an application has been submitted.");
    expect((await getInterviewSchedules(applicationId, userId)).find((item) => item.id === interview.id)?.status).toBe("cancelled");
    expect((await getUpcomingInterviews(userId)).some((item) => item.interview.id === interview.id)).toBe(false);

    const artifacts = await getApplicationLedgerArtifacts(applicationId, userId);
    expect(artifacts.auditEvents.some((event) =>
      event.action === "application_actions_retired_after_offer_acceptance" &&
      event.afterState?.includes(String(followUpApproval!.id)) &&
      event.afterState?.includes(String(interview.id)) &&
      event.afterState?.includes("externalFollowUpSent\":false")
    )).toBe(true);
  });
});
