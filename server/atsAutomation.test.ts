import { describe, expect, it } from "vitest";
import {
  CAPTCHAHandler,
  TaleoAutomation,
  WorkdayAutomation,
  applyWithATS,
} from "./atsAutomation";

const applicationData = {
  firstName: "Alex",
  lastName: "Example",
  email: "alex@example.com",
  phone: "555-0100",
  resume: {
    url: "https://example.com/resume.pdf",
    filename: "resume.pdf",
  },
  workAuthorization: "authorized",
  requiresSponsorship: false,
};

describe("guarded legacy ATS automation", () => {
  it.each([
    [
      "Workday",
      new WorkdayAutomation(),
      "https://example.myworkdayjobs.com/job/123",
    ],
    [
      "Taleo",
      new TaleoAutomation(),
      "https://example.taleo.net/careersection/jobdetail",
    ],
  ] as const)(
    "blocks unattended final submission through %s",
    async (_name, automation, url) => {
      const result = await automation.apply(url, applicationData);

      expect(result).toMatchObject({
        success: false,
        status: "partial",
      });
      expect(result.message).toContain("final submission is disabled");
    }
  );

  it("keeps the public ATS entry point preparation-only", async () => {
    const result = await applyWithATS(
      "https://boards.greenhouse.io/example/jobs/1",
      applicationData
    );

    expect(result.success).toBe(false);
    expect(result.status).toBe("partial");
    expect(result.nextSteps).toContain("Complete any login or CAPTCHA challenge directly on the employer portal.");
  });

  it("never solves CAPTCHA challenges or routes them to an external service", async () => {
    const handler = new CAPTCHAHandler();

    await expect(handler.detectCAPTCHA()).resolves.toEqual({ detected: false });
    await expect(handler.solveCAPTCHA()).resolves.toMatchObject({
      solved: false,
      method: "manual",
      error: expect.stringContaining("disabled"),
    });
  });
});
