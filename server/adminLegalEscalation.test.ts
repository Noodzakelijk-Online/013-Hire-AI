import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { adminRouter } from "./routers/admin";

const mocks = vi.hoisted(() => {
  const selectLimit = vi.fn();
  const updateWhere = vi.fn();
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const stripeUpdate = vi.fn();
  const mockDb = {
    select: vi.fn(),
    update: vi.fn(() => ({ set: updateSet })),
  };

  return {
    mockDb,
    selectLimit,
    updateWhere,
    updateSet,
    stripeUpdate,
    createAdminReviewItem: vi.fn(),
    createAuditEvent: vi.fn(),
    getDb: vi.fn(),
  };
});

vi.mock("./db", () => ({
  createAdminReviewItem: mocks.createAdminReviewItem,
  createAuditEvent: mocks.createAuditEvent,
  getDb: mocks.getDb,
  getAdminReviewEvidenceSnapshot: vi.fn(),
  listAdminReviewItems: vi.fn(),
  resolveAdminReviewItem: vi.fn(),
}));

vi.mock("./stripeClient", () => ({
  getStripeClient: vi.fn(() => ({
    subscriptions: { update: mocks.stripeUpdate },
  })),
}));

function createAdminContext(userId: number): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `legal-admin-${userId}`,
      name: "Legal Admin",
      email: `legal-admin-${userId}@example.local`,
      loginMethod: "test",
      role: "admin",
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

describe("admin legal escalation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockResolvedValue(mocks.mockDb);
    mocks.updateWhere.mockResolvedValue([{ affectedRows: 1 }]);
    mocks.stripeUpdate.mockResolvedValue({ id: "sub_test" });

    const disputedFee = {
      id: 91,
      userId: 500,
      status: "active",
      stripeSubscriptionId: "sub_disputed",
      notes: "Prior fee note",
    };
    const relatedActiveFee = {
      id: 92,
      userId: 500,
      status: "active",
      stripeSubscriptionId: "sub_related",
      notes: null,
    };

    mocks.selectLimit.mockResolvedValue([disputedFee]);
    mocks.mockDb.select
      .mockImplementationOnce(() => ({
        from: () => ({
          where: () => ({ limit: mocks.selectLimit }),
        }),
      }))
      .mockImplementationOnce(() => ({
        from: () => ({
          where: () => Promise.resolve([disputedFee, relatedActiveFee]),
        }),
      }));
  });

  it("pauses the disputed subscription and suspends every active fee before suspending the account", async () => {
    const caller = adminRouter.createCaller(createAdminContext(70));

    const result = await caller.flagLegalEscalation({
      feeId: 91,
      reason: "Required employment verification remained unresolved.",
    });

    expect(result.success).toBe(true);
    expect(mocks.stripeUpdate).toHaveBeenCalledWith("sub_disputed", {
      pause_collection: { behavior: "void" },
    });
    expect(mocks.stripeUpdate).toHaveBeenCalledWith("sub_related", {
      pause_collection: { behavior: "void" },
    });
    expect(mocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: "disputed" }));
    expect(mocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({
      status: "suspended",
      notes: expect.stringContaining("success fee #91"),
    }));
    expect(mocks.createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      entityType: "success_fee",
      entityId: 92,
      action: "success_fee_suspended_for_legal_escalation",
      riskLevel: "critical",
    }));
    expect(mocks.createAdminReviewItem).toHaveBeenCalledWith(expect.objectContaining({
      userId: 500,
      entityType: "success_fee",
      entityId: 91,
      category: "legal_escalation",
      priority: "critical",
    }));
  });
});
