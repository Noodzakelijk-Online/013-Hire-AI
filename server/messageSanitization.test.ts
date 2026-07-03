import { describe, expect, it } from "vitest";
import {
  MAX_FOLLOW_UP_MESSAGE_CHARS,
  sanitizeFollowUpMessage,
} from "./messageSanitization";

describe("sanitizeFollowUpMessage", () => {
  it("normalizes line endings and strips unsafe control characters", () => {
    const message = sanitizeFollowUpMessage(" Hello\r\nthere\u0000\u0007 \rNext\tline ");

    expect(message).toBe("Hello\nthere\nNext\tline");
  });

  it("preserves regular tabs and newlines used for readable drafts", () => {
    const message = sanitizeFollowUpMessage("Hi,\n\n\tThanks for your time.\n");

    expect(message).toBe("Hi,\n\n\tThanks for your time.");
  });

  it("rejects empty messages after cleanup", () => {
    expect(() => sanitizeFollowUpMessage("\u0000 \n\t")).toThrow("cannot be empty");
  });

  it("rejects oversized messages", () => {
    expect(() => sanitizeFollowUpMessage("x".repeat(MAX_FOLLOW_UP_MESSAGE_CHARS + 1))).toThrow(
      "cannot exceed"
    );
  });
});
