import { describe, expect, it } from "vitest";
import { recordEmployerResponse } from "./applicationFeatures";
import { createApplication, getAuditEventsForEntity, getEmployerResponses } from "./db";

describe("employer response source-reference idempotency", () => {
  it("keeps retries from duplicating the response ledger or status transition", async () => {
    const userId = 99161;
    const application = await createApplication({
      userId,
      jobId: 1,
      status: "applied",
      notes: "Application submission was confirmed.",
    });
    const applicationId = Number(application.insertId);
    const input = {
      applicationId,
      responseType: "interview_invite" as const,
      source: "email" as const,
      sourceReference: "gmail-message-99161",
      summary: "Recruiter requested availability for a video interview next week.",
      receivedAt: new Date(),
    };

    const first = await recordEmployerResponse(input, userId);
    const retry = await recordEmployerResponse(input, userId);
    const responses = await getEmployerResponses(applicationId, userId);
    const auditEvents = await getAuditEventsForEntity(userId, "application", applicationId);

    expect(first).toMatchObject({ success: true, existing: false, status: "interview" });
    expect(retry).toMatchObject({ success: true, existing: true, responseId: first.responseId, status: "interview" });
    expect(responses).toHaveLength(1);
    expect(auditEvents.filter((event) => event.action === "employer_response_recorded")).toHaveLength(1);
    expect(auditEvents.find((event) => event.action === "employer_response_recorded")?.afterState)
      .toContain('"sourceReferencePresent":true');
  });

  it("refuses to reuse one external message reference for another application", async () => {
    const userId = 99162;
    const firstApplication = await createApplication({ userId, jobId: 2, status: "applied" });
    const secondApplication = await createApplication({ userId, jobId: 3, status: "applied" });
    const sourceReference = "outlook-message-99162";

    await recordEmployerResponse({
      applicationId: Number(firstApplication.insertId),
      responseType: "viewed",
      source: "email",
      sourceReference,
      summary: "Recruiter opened the application and reviewed the submitted materials.",
    }, userId);

    await expect(recordEmployerResponse({
      applicationId: Number(secondApplication.insertId),
      responseType: "viewed",
      source: "email",
      sourceReference,
      summary: "Recruiter opened another application record by mistake.",
    }, userId)).rejects.toThrow(/another application/i);
  });
});
