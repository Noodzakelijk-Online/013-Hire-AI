import { describe, expect, it } from "vitest";
import {
  INTERVIEW_INVITE_SOURCE_REFERENCE_REQUIRED_MESSAGE,
  normalizeEmployerResponse,
  normalizeEmployerResponseSourceReference,
  resolveEmployerResponseStatus,
} from "./applicationResponses";

describe("application employer response classification", () => {
  it("maps consequential employer replies to lifecycle statuses", () => {
    expect(resolveEmployerResponseStatus("applied", "viewed")).toBe("viewed");
    expect(resolveEmployerResponseStatus("applied", "interview_invite")).toBe("interview");
    expect(resolveEmployerResponseStatus("interview", "offer")).toBe("offer");
    expect(resolveEmployerResponseStatus("applied", "rejection")).toBe("rejected");
    expect(resolveEmployerResponseStatus("interview", "no_response")).toBeNull();
  });

  it("records a traceable response note", () => {
    const receivedAt = new Date("2026-06-28T12:00:00.000Z");
    const response = normalizeEmployerResponse(
      {
        responseType: "interview_invite",
        source: "email",
        sourceReference: "gmail-interview-availability-701",
        summary: "Recruiter asked for interview availability next week.",
        receivedAt,
      },
      "applied",
      receivedAt
    );

    expect(response.nextStatus).toBe("interview");
    expect(response.noteContent).toContain("interview invite via email");
    expect(response.noteContent).toContain("Recruiter asked");
    expect(response.noteContent).toContain("gmail-interview-availability-701");
  });

  it("rejects vague responses before they enter the ledger", () => {
    expect(() =>
      normalizeEmployerResponse(
        { responseType: "other", source: "other", summary: "ok" },
        "applied"
      )
    ).toThrow(/summary/i);

    expect(() =>
      normalizeEmployerResponse(
        { responseType: "offer", source: "email", summary: "Offer received by email." },
        "pending"
      )
    ).toThrow(/submission/i);

    expect(() =>
      normalizeEmployerResponse(
        {
          responseType: "interview_invite",
          source: "email",
          summary: "Recruiter invited the candidate to a technical interview.",
        },
        "applied"
      )
    ).toThrow(INTERVIEW_INVITE_SOURCE_REFERENCE_REQUIRED_MESSAGE);
  });

  it("normalizes stable source references without storing message content", () => {
    expect(normalizeEmployerResponseSourceReference("  gmail-msg-123  ")).toBe("gmail-msg-123");
    expect(normalizeEmployerResponseSourceReference(" ")).toBeNull();
    expect(() => normalizeEmployerResponseSourceReference("id")).toThrow(/too short/i);
    expect(() => normalizeEmployerResponseSourceReference("message id 123")).toThrow(/whitespace/i);
  });
});
