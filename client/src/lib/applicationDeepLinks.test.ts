import { describe, expect, it } from "vitest";
import {
  getApplicationDeepLink,
  parseApplicationDeepLink,
} from "./applicationDeepLinks";

describe("application deep links", () => {
  it("builds stable application routes", () => {
    expect(getApplicationDeepLink(42)).toBe("/applications?applicationId=42");
    expect(getApplicationDeepLink(42, "schedule-interview")).toBe(
      "/applications?applicationId=42&action=schedule-interview"
    );
    expect(getApplicationDeepLink(42, "record-interview-invitation")).toBe(
      "/applications?applicationId=42&action=record-interview-invitation"
    );
    expect(getApplicationDeepLink(42, "record-interview-outcome", 9)).toBe(
      "/applications?applicationId=42&action=record-interview-outcome&interviewId=9"
    );
    expect(getApplicationDeepLink(42, "follow-up")).toBe(
      "/applications?applicationId=42&action=follow-up"
    );
    expect(getApplicationDeepLink(42, "employer-response")).toBe(
      "/applications?applicationId=42&action=employer-response"
    );
    expect(getApplicationDeepLink(42, "send-follow-up")).toBe(
      "/applications?applicationId=42&action=send-follow-up"
    );
  });

  it("parses application deep links from full paths or search strings", () => {
    expect(parseApplicationDeepLink("/applications?applicationId=42&action=schedule-interview")).toEqual({
      applicationId: 42,
      action: "schedule-interview",
    });
    expect(parseApplicationDeepLink("?applicationId=43&action=record-interview-invitation")).toEqual({
      applicationId: 43,
      action: "record-interview-invitation",
    });
    expect(parseApplicationDeepLink("?applicationId=7")).toEqual({
      applicationId: 7,
      action: "view",
    });
    expect(parseApplicationDeepLink("?applicationId=9&action=follow-up")).toEqual({
      applicationId: 9,
      action: "follow-up",
    });
    expect(parseApplicationDeepLink("?applicationId=10&action=employer-response")).toEqual({
      applicationId: 10,
      action: "employer-response",
    });
    expect(parseApplicationDeepLink("?applicationId=11&action=send-follow-up")).toEqual({
      applicationId: 11,
      action: "send-follow-up",
    });
    expect(parseApplicationDeepLink("?applicationId=12&action=record-interview-outcome&interviewId=18")).toEqual({
      applicationId: 12,
      action: "record-interview-outcome",
      interviewId: 18,
    });
  });

  it("rejects invalid ids and falls back for unknown actions", () => {
    expect(parseApplicationDeepLink("?applicationId=0")).toBeNull();
    expect(parseApplicationDeepLink("?applicationId=nope")).toBeNull();
    expect(parseApplicationDeepLink("?applicationId=8&action=delete")).toEqual({
      applicationId: 8,
      action: "view",
    });
    expect(parseApplicationDeepLink("?applicationId=8&action=record-interview-outcome")).toEqual({
      applicationId: 8,
      action: "view",
    });
  });
});
