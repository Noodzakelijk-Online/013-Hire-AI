import { describe, expect, it } from "vitest";
import { automateApplication, getResumeUploadBlocker } from "./browserAutomation";

const applicationData = {
  firstName: "Alex",
  lastName: "Example",
  email: "alex@example.com",
  resumeUrl: "https://example.com/resume.pdf",
};

describe("browser application preparation", () => {
  it("blocks before browser startup when a resume cannot be attached", async () => {
    const result = await automateApplication(
      "https://boards.greenhouse.io/example/jobs/1",
      applicationData
    );

    expect(result).toMatchObject({
      success: false,
      prepared: false,
    });
    expect(result.error).toContain("server-resolved local resume artifact");
  });

  it("requires both resume metadata and a local attachment path", () => {
    expect(getResumeUploadBlocker({ ...applicationData, resumeFilePath: "C:/tmp/resume.pdf" })).toBeNull();
    expect(getResumeUploadBlocker({ ...applicationData, resumeUrl: undefined })).toContain("resume is required");
  });
});
