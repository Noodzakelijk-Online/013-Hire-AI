import { describe, expect, it, vi } from "vitest";
import {
  applyToJob,
  detectATSType,
  getPortalPreparationLedgerState,
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

  it("does not write application URLs or ATS data to server logs", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    try {
      await applyToJob(
        "https://boards.greenhouse.io/example/jobs/1?token=one-time-token",
        applicationData
      );

      expect(log).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
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

  it("keeps portal persistence evidence-gated even for a success-shaped result", () => {
    expect(getPortalPreparationLedgerState({
      success: true,
      prepared: true,
      submissionAttempted: true,
      externalSubmissionPerformed: true,
      reviewRequired: false,
      atsType: "greenhouse",
      message: "Employer portal claimed success.",
      submissionEvidence: {
        source: "employer_portal",
        evidence: "The portal displayed confirmation reference ABC-123.",
      },
    })).toEqual({
      status: "pending",
      isAutoApplied: 0,
      attemptStatus: "prepared",
      externalSubmissionPerformed: false,
      auditAction: "application_prepared_by_automation",
    });
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
