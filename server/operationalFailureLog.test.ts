import { afterEach, describe, expect, it, vi } from "vitest";
import { logOperationalFailure } from "./operationalFailureLog";

describe("operational failure logging", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits a fixed marker without accepting upstream error details", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logOperationalFailure("ResumeParser", "PDF extraction");

    expect(errorSpy).toHaveBeenCalledWith("[ResumeParser] PDF extraction failed.");
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("provider-secret");
  });
});
