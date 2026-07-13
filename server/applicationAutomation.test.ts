import { describe, expect, it } from "vitest";
import {
  applyToJob,
  detectATSType,
  getVerifiedApplicationSubmissionEvidence,
  isAutomationSupported,
  validateApplicationData,
} from "./applicationAutomation";

const applicationData = {
  firstName: "Alex",
  lastName: "Example",
  email: "alex@example.com",
  resumeUrl: "https://example.com/resume.pdf",
  resumeFileKey: "resumes/alex/resume.pdf",
};

describe("guarded application preparation", () => {
  it("detects common ATS destinations", () => {
    expect(detectATSType("https://boards.greenhouse.io/example/jobs/1")).toBe("greenhouse");
    expect(detectATSType("https://jobs.lever.co/example/1")).toBe("lever");
  });

  it("reports preparation without claiming a submission attempt", async () => {
    const result = await applyToJob(
      "https://boards.greenhouse.io/example/jobs/1",
      applicationData
    );

    expect(result).toMatchObject({
      success: false,
      prepared: true,
      submissionAttempted: false,
      externalSubmissionPerformed: false,
      reviewRequired: true,
      atsType: "greenhouse",
    });
  });

  it("does not claim it can prepare or access an employer portal form", () => {
    const support = isAutomationSupported("https://boards.greenhouse.io/example/jobs/1");

    expect(support).toMatchObject({
      atsType: "greenhouse",
      supported: false,
      preparationSupported: false,
    });
    expect(support.message).toContain("does not access employer portal forms");
  });

  it("does not treat a generic success flag as submission evidence", () => {
    expect(getVerifiedApplicationSubmissionEvidence({
      success: true,
      prepared: true,
      submissionAttempted: false,
      externalSubmissionPerformed: false,
      reviewRequired: false,
      atsType: "greenhouse",
      message: "Prepared application.",
      confirmationId: "unverified-123",
    })).toBeNull();
  });

  it("requires a versioned resume key before preparation can be trusted", () => {
    const validation = validateApplicationData({
      ...applicationData,
      resumeFileKey: "",
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("Active versioned resume is required");
  });
});
