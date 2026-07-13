import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { getAuditEventsForUser } from "./db";

const mocks = vi.hoisted(() => ({
  discoverLinkedInIdentity: vi.fn(),
}));

vi.mock("./linkedInProfileDiscovery", () => ({
  discoverLinkedInIdentity: mocks.discoverLinkedInIdentity,
}));

import { appRouter } from "./routers";

function createContext(userId: number): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `linkedin-profile-${userId}`,
      name: "LinkedIn Profile User",
      email: `linkedin-profile-${userId}@example.local`,
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

describe("LinkedIn identity discovery route", () => {
  it("returns reviewed identity details while storing only non-sensitive audit metadata", async () => {
    const userId = 99131;
    mocks.discoverLinkedInIdentity.mockResolvedValue({
      provider: "linkedin",
      name: "Avery Example",
      email: "avery@example.test",
      emailVerified: true,
    });
    const caller = appRouter.createCaller(createContext(userId));

    const result = await caller.profile.discoverLinkedInIdentity();
    const audits = await getAuditEventsForUser(userId, 10);
    const audit = audits.find((event) => event.action === "linkedin_identity_discovered");

    expect(mocks.discoverLinkedInIdentity).toHaveBeenCalledWith(userId);
    expect(result).toMatchObject({ name: "Avery Example", emailVerified: true });
    expect(audit?.afterState).toBe('{"hasName":true,"hasEmail":true,"emailVerified":true}');
    expect(audit?.afterState).not.toContain("Avery");
    expect(audit?.afterState).not.toContain("avery@example.test");
  });
});
