import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { recordEmployerResponse } from "./applicationFeatures";
import { getAuditEventsForEntity, createApplication, listUnreadInterviewNotifications } from "./db";
import { getUserOperatingLedger } from "./applicationCampaigns";
import { appRouter } from "./routers";

function createContext(userId: number): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `interview-notification-${userId}`,
      name: "Interview Notification User",
      email: `interview-notification-${userId}@example.local`,
      loginMethod: "test",
      role: "user",
      stripeCustomerId: null,
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

describe("interview notification ledger", () => {
  it("creates one unread in-app notification only for an evidence-backed interview invite", async () => {
    const userId = 99171;
    const application = await createApplication({
      userId,
      jobId: 1,
      status: "applied",
      notes: "Submission was confirmed by the applicant.",
    });
    const applicationId = Number(application.insertId);

    await recordEmployerResponse({
      applicationId,
      responseType: "employer_question",
      source: "email",
      sourceReference: "gmail-question-99171",
      summary: "Recruiter asked the candidate to clarify availability for the role.",
    }, userId);
    expect(await listUnreadInterviewNotifications(userId)).toHaveLength(0);

    const invite = {
      applicationId,
      responseType: "interview_invite" as const,
      source: "email" as const,
      sourceReference: "gmail-interview-99171",
      summary: "Recruiter invited the candidate to a video interview and requested availability.",
    };
    const first = await recordEmployerResponse(invite, userId);
    const retry = await recordEmployerResponse(invite, userId);
    const notifications = await listUnreadInterviewNotifications(userId);
    const ledger = await getUserOperatingLedger(userId);

    expect(first).toMatchObject({ success: true, existing: false, status: "interview" });
    expect(retry).toMatchObject({ success: true, existing: true, responseId: first.responseId });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      applicationId,
      employerResponseId: first.responseId,
      notificationType: "interview_invite",
      readAt: null,
    });
    expect(ledger.metrics.unreadInterviewNotifications).toBe(1);
    expect(ledger.queues.interviewNotifications).toEqual([
      expect.objectContaining({
        applicationId,
        employerResponseId: first.responseId,
        notificationType: "interview_invite",
      }),
    ]);
    expect(ledger.nextActions.some((action) => action.includes("verified interview invite"))).toBe(true);

    const auditEvents = await getAuditEventsForEntity(userId, "application", applicationId);
    expect(auditEvents.filter((event) => event.action === "interview_notification_queued")).toHaveLength(1);
  });

  it("acknowledges only the owning user's unread interview notification and records that acknowledgement", async () => {
    const userId = 99172;
    const application = await createApplication({ userId, jobId: 2, status: "applied" });
    const applicationId = Number(application.insertId);
    await recordEmployerResponse({
      applicationId,
      responseType: "interview_invite",
      source: "employer_portal",
      sourceReference: "portal-interview-99172",
      summary: "The employer portal confirmed an interview invitation for this application.",
    }, userId);
    const [notification] = await listUnreadInterviewNotifications(userId);
    const owner = appRouter.createCaller(createContext(userId));
    const otherUser = appRouter.createCaller(createContext(99173));

    await expect(otherUser.applications.markInterviewNotificationRead({ notificationId: notification.id }))
      .rejects.toThrow(/not found/i);

    const read = await owner.applications.markInterviewNotificationRead({ notificationId: notification.id });
    const retry = await owner.applications.markInterviewNotificationRead({ notificationId: notification.id });
    const auditEvents = await getAuditEventsForEntity(userId, "application", applicationId);

    expect(read).toMatchObject({ success: true, changed: true });
    expect(retry).toMatchObject({ success: true, changed: false });
    expect(await listUnreadInterviewNotifications(userId)).toHaveLength(0);
    expect(auditEvents.filter((event) => event.action === "interview_notification_read")).toHaveLength(1);
  });
});
