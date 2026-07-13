import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLoginUrl } from "../const";

describe("getLoginUrl", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      location: { origin: "http://localhost:3100" },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses the development session when hosted OAuth is not configured", () => {
    vi.stubEnv("VITE_OAUTH_PORTAL_URL", "");
    vi.stubEnv("VITE_APP_ID", "");

    expect(getLoginUrl()).toBe("/api/dev/login");
  });

  it("uses configured hosted OAuth when it is available", () => {
    vi.stubEnv("VITE_OAUTH_PORTAL_URL", "https://auth.example.test");
    vi.stubEnv("VITE_APP_ID", "hire-ai-test");

    expect(getLoginUrl()).toContain("https://auth.example.test/app-auth?");
    expect(getLoginUrl()).toContain("appId=hire-ai-test");
  });
});
