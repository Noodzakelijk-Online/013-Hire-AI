import { describe, expect, it } from "vitest";
import { getAutonomousUserEligibility, getUserByOpenId, upsertUser } from "./db";

describe("autonomous user eligibility", () => {
  it("fails closed when no durable user record can be found", async () => {
    await expect(getAutonomousUserEligibility(9_999_999)).resolves.toEqual({
      eligible: false,
      reason: "User account was not found.",
    });
  });

  it("enforces account status and Terms acceptance in the local memory fallback", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    await upsertUser({
      openId: `autonomous-terms-${suffix}`,
      accountStatus: "active",
      tosAcceptedAt: null,
    });
    const termsUser = await getUserByOpenId(`autonomous-terms-${suffix}`);
    await expect(getAutonomousUserEligibility(termsUser!.id)).resolves.toEqual({
      eligible: false,
      reason: "Terms of Service acceptance is required before autonomous actions can run.",
    });

    await upsertUser({
      openId: `autonomous-suspended-${suffix}`,
      accountStatus: "suspended",
      tosAcceptedAt: new Date(),
    });
    const suspendedUser = await getUserByOpenId(`autonomous-suspended-${suffix}`);
    await expect(getAutonomousUserEligibility(suspendedUser!.id)).resolves.toEqual({
      eligible: false,
      reason: "Autonomous actions are disabled while the account is not active.",
    });

    await upsertUser({
      openId: `autonomous-active-${suffix}`,
      accountStatus: "active",
      tosAcceptedAt: new Date(),
    });
    const activeUser = await getUserByOpenId(`autonomous-active-${suffix}`);
    await expect(getAutonomousUserEligibility(activeUser!.id)).resolves.toEqual({ eligible: true });
  });
});
