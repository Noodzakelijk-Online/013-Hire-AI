import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { getUserProfile } from "./db";
import { appRouter } from "./routers";

function createContext(userId: number): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `profile-preferences-${userId}`,
      email: `profile-preferences-${userId}@example.local`,
      name: "Profile Preferences User",
      loginMethod: "test",
      role: "user",
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

describe("profile search preference router", () => {
  it("persists and clears autonomous search targets without retaining stale values", async () => {
    const userId = 190081;
    const caller = appRouter.createCaller(createContext(userId));

    await caller.profile.update({
      desiredJobTypes: "Frontend Engineer, full-time",
      desiredLocations: "Remote, Netherlands",
      salaryExpectationMin: 90000,
      salaryExpectationMax: 130000,
      needsVisaSponsorship: 1,
    });

    expect(await getUserProfile(userId)).toMatchObject({
      desiredJobTypes: "Frontend Engineer, full-time",
      desiredLocations: "Remote, Netherlands",
      salaryExpectationMin: 90000,
      salaryExpectationMax: 130000,
      needsVisaSponsorship: 1,
    });

    await caller.profile.update({
      desiredJobTypes: null,
      desiredLocations: null,
      salaryExpectationMin: null,
      salaryExpectationMax: null,
      needsVisaSponsorship: 0,
    });

    expect(await getUserProfile(userId)).toMatchObject({
      desiredJobTypes: null,
      desiredLocations: null,
      salaryExpectationMin: null,
      salaryExpectationMax: null,
      needsVisaSponsorship: 0,
    });
  });

  it("rejects an invalid salary range", async () => {
    const caller = appRouter.createCaller(createContext(190082));

    await expect(caller.profile.update({
      salaryExpectationMin: 140000,
      salaryExpectationMax: 90000,
    })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("Maximum salary"),
    });
  });
});
