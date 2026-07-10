import { describe, expect, it } from "vitest";
import {
  applyToJob,
  detectATSType,
  getVerifiedApplicationSubmissionEvidence,
} from "./applicationAutomation";

const applicationData = {
  firstName: "Alex",
  lastName: "Example",
  email: "alex@example.com",
  resumeUrl: "https://example.com/resume.pdf",
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
});
