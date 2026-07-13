import { describe, expect, it } from "vitest";
import { getConnectorRequestAction } from "./connectorConnectionControl";

describe("connector connection control", () => {
  it("keeps manually verified portfolio evidence out of the OAuth flow", () => {
    expect(getConnectorRequestAction("portfolio", false)).toBe("record_request");
    expect(getConnectorRequestAction("portfolio", undefined)).toBe("record_request");
  });

  it("records a request when an OAuth provider is unavailable in the deployment", () => {
    expect(getConnectorRequestAction("dropbox", false)).toBe("record_request");
  });

  it("starts authorization only for a configured OAuth provider", () => {
    expect(getConnectorRequestAction("gmail", true)).toBe("start_oauth");
    expect(getConnectorRequestAction("google_drive", undefined)).toBe("start_oauth");
  });
});
