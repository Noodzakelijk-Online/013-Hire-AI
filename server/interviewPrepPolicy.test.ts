import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  invokeLLM: vi.fn(),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: mocks.invokeLLM,
}));

import { recordEmployerResponse, scheduleInterview } from "./applicationFeatures";
import { createApplication } from "./db";
import { appRouter } from "./routers";

function createContext(userId: number): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `interview-policy-${userId}`,
      email: `interview-policy-${userId}@example.com`,
      name: "Interview Policy User",
      loginMethod: "test",
      role: "user",
      accountStatus: "active",
      stripeCustomerId: null,
      tosAcceptedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as TrpcContext["user"],
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe("interview preparation policy", () => {
  it("rejects legacy preparation requests without an owned upcoming interview before invoking AI", async () => {
    const caller = appRouter.createCaller(createContext(99701));

    await expect(caller.interviewPrep.generateQuestions({ applicationId: 999_999 })).rejects.toThrow(
      "Application not found."
    );
    await expect(caller.interviewPrep.mockInterview({
      applicationId: 999_999,
      userResponse: "I would lead with the relevant delivery outcome.",
      questionIndex: 0,
    })).rejects.toThrow("Application not found.");
    await expect(caller.interviewPrep.videoTips({ applicationId: 999_999 })).rejects.toThrow(
      "Application not found."
    );

    expect(mocks.invokeLLM).not.toHaveBeenCalled();
  });

  it("allows interview coaching only after a recorded invite and future schedule", async () => {
    const userId = 99702;
    const application = await createApplication({
      userId,
      jobId: 2,
      status: "interview",
      notes: "Employer invited the candidate to interview.",
    });
    const applicationId = Number(application.insertId);
    await recordEmployerResponse({
      applicationId,
      responseType: "interview_invite",
      source: "email",
      sourceReference: `gmail-interview-policy-${applicationId}`,
      summary: "Recruiter invited the candidate to a video interview.",
    }, userId);
    await scheduleInterview({
      applicationId,
      interviewType: "video",
      scheduledAt: new Date(Date.now() + 2 * 86400000),
      meetingLink: "https://meet.example.com/interview-policy",
    }, userId);
    mocks.invokeLLM.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            behavioral: ["Tell me about a delivery outcome."],
            technical: ["How do you design a reliable interface?"],
            situational: ["How would you handle an ambiguous requirement?"],
            questions_to_ask: ["How is success measured?"],
          }),
        },
      }],
    });

    const caller = appRouter.createCaller(createContext(userId));
    const result = await caller.interviewPrep.generateQuestions({ applicationId });

    expect(result.behavioral).toEqual(["Tell me about a delivery outcome."]);
    expect(mocks.invokeLLM).toHaveBeenCalledTimes(1);
  });
});
