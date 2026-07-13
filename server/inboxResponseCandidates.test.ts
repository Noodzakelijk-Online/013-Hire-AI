import { describe, expect, it } from "vitest";
import {
  listPendingInboxResponseCandidates,
  resolveInboxResponseCandidateBySourceReference,
  upsertInboxResponseCandidate,
} from "./db";

describe("inbox response candidate ledger", () => {
  it("deduplicates candidate discovery and removes a dismissed message from the pending queue", async () => {
    const userId = 99701;
    const input = {
      userId,
      applicationId: 1,
      provider: "gmail" as const,
      messageId: "candidate-99701",
      sender: "recruiter@example.test",
      subject: "Interview invitation",
      preview: "Can we schedule a first interview?",
      receivedAt: new Date("2026-07-13T12:00:00.000Z"),
      suggestedResponseType: "interview_invite" as const,
      confidence: "high" as const,
    };

    expect((await upsertInboxResponseCandidate(input)).existing).toBe(false);
    expect((await upsertInboxResponseCandidate(input)).existing).toBe(true);
    await expect(listPendingInboxResponseCandidates(userId)).resolves.toEqual([
      expect.objectContaining({ messageId: "candidate-99701", status: "pending" }),
    ]);

    await expect(resolveInboxResponseCandidateBySourceReference({
      userId,
      provider: "gmail",
      messageId: "candidate-99701",
      status: "dismissed",
    })).resolves.toEqual(expect.objectContaining({ status: "dismissed" }));
    await expect(listPendingInboxResponseCandidates(userId)).resolves.toEqual([]);
  });
});
