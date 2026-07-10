import { describe, expect, it } from "vitest";
import {
  BrowserAutomation,
  automateApplication,
  getResumeUploadBlocker,
  isPreparationSupported,
} from "./browserAutomation";

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

  it("returns a manual handoff without launching or filling an employer portal", async () => {
    const result = await automateApplication(
      "https://boards.greenhouse.io/example/jobs/1",
      { ...applicationData, resumeFilePath: "C:/tmp/resume.pdf" }
    );

    expect(result).toMatchObject({
      success: false,
      prepared: false,
      error: expect.stringContaining("disabled"),
    });
    expect(result.logs).toContain("No employer portal browser was launched.");
    expect(result.logs).toContain("No form field was populated and no document was uploaded.");
    expect(isPreparationSupported("greenhouse")).toBe(false);
    await expect(new BrowserAutomation().initialize()).resolves.toBe(false);
  });
});
