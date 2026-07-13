import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  refreshProfileMatchLedger: vi.fn(),
}));

vi.mock("./profileMatchLedger", () => mocks);

import { appRouter } from "./routers";

function createContext(userId: number): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `profile-match-ledger-${userId}`,
      email: `profile-match-ledger-${userId}@example.local`,
      name: "Profile Match Ledger User",
      loginMethod: "test",
      role: "user",
      stripeCustomerId: null,
      accountStatus: "active",
      tosAcceptedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("profile match ledger router integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.refreshProfileMatchLedger.mockResolvedValue({
      profileAvailable: true,
      consideredJobs: 3,
      refreshedMatches: 3,
      failedMatches: 0,
    });
  });

  it("reconciles persisted matches after an evidence-bearing profile update", async () => {
    const caller = appRouter.createCaller(createContext(99141));

    const result = await caller.profile.update({ skills: "TypeScript, React" });

    expect(mocks.refreshProfileMatchLedger).toHaveBeenCalledWith({
      userId: 99141,
      source: "profile.update",
    });
    expect(result).toMatchObject({
      success: true,
      matchRefresh: { refreshedMatches: 3 },
    });
  });

  it("does not recompute matches when only non-matching preferences change", async () => {
    const caller = appRouter.createCaller(createContext(99142));

    const result = await caller.profile.update({ preferences: '{"scanFrequency":"daily"}' });

    expect(mocks.refreshProfileMatchLedger).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: true, matchRefresh: null });
  });
});
