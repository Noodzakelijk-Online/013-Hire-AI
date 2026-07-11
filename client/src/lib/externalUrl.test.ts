import { describe, expect, it } from "vitest";
import { getSafeExternalUrl } from "./externalUrl";

describe("external URL safety", () => {
  it("allows HTTP and HTTPS links", () => {
    expect(getSafeExternalUrl("https://example.com/jobs/1")).toBe("https://example.com/jobs/1");
    expect(getSafeExternalUrl("http://example.com/jobs/1")).toBe("http://example.com/jobs/1");
  });

  it("rejects executable and malformed schemes", () => {
    expect(getSafeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(getSafeExternalUrl("data:text/html,unsafe")).toBeNull();
    expect(getSafeExternalUrl("not a url")).toBeNull();
  });
});
