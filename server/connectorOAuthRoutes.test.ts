import { describe, expect, it } from "vitest";
import { getMissingProviderScopes } from "./connectorOAuthRoutes";

describe("connector OAuth callback scope boundary", () => {
  it("requires mailbox read authority by default and send authority only for an explicit delivery consent", () => {
    expect(getMissingProviderScopes("gmail", [
      "https://www.googleapis.com/auth/gmail.metadata",
    ])).toEqual([]);

    expect(getMissingProviderScopes("gmail", [
      "https://www.googleapis.com/auth/gmail.metadata",
    ], ["email.metadata.read", "email.messages.read_recruiting", "email.messages.send"])).toEqual([
      "https://www.googleapis.com/auth/gmail.send",
    ]);
  });

  it("does not treat internal consent labels as proof that Outlook or Drive granted read authority", () => {
    expect(getMissingProviderScopes("outlook", ["Mail.Send"])).toEqual(["Mail.Read"]);
    expect(getMissingProviderScopes("google_drive", [])).toEqual([
      "https://www.googleapis.com/auth/drive.readonly",
    ]);
  });

  it("accepts an exact provider grant even when the token response includes whitespace", () => {
    expect(getMissingProviderScopes("dropbox", [
      " files.metadata.read ",
      "files.content.read",
    ])).toEqual([]);
  });
});
