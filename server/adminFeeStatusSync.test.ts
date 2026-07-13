import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => {
  const selectLimit = vi.fn();
  const updateWhere = vi.fn();
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const stripeCancel = vi.fn();
  const stripeUpdate = vi.fn();
  const mockDb = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: selectLimit })),
      })),
    })),
    update: vi.fn(() => ({ set: updateSet })),
  };

  return {
    createAdminReviewItem: vi.fn(),
    createAuditEvent: vi.fn(),
    getAdminMemoryFallback: vi.fn(),
    getAdminReviewEvidenceSnapshot: vi.fn(),
    getDb: vi.fn(),
    listAdminReviewItems: vi.fn(),
    mockDb,
    resolveAdminReviewItem: vi.fn(),
    selectLimit,
    stripeCancel,
    stripeUpdate,
    updateSet,
    updateWhere,
  };
});

vi.mock("./db", () => ({
  createAdminReviewItem: mocks.createAdminReviewItem,
  createAuditEvent: mocks.createAuditEvent,
  getAdminMemoryFallback: mocks.getAdminMemoryFallback,
  getAdminReviewEvidenceSnapshot: mocks.getAdminReviewEvidenceSnapshot,
  getDb: mocks.getDb,
  listAdminReviewItems: mocks.listAdminReviewItems,
  resolveAdminReviewItem: mocks.resolveAdminReviewItem,
}));

vi.mock("./stripeClient", () => ({
  getStripeClient: vi.fn(() => ({
    subscriptions: {
      cancel: mocks.stripeCancel,
      update: mocks.stripeUpdate,
    },
  })),
}));

import { adminRouter } from "./routers/admin";

function createAdminContext(userId: number): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `billing-admin-${userId}`,
      name: "Billing Admin",
      email: `billing-admin-${userId}@example.local`,
      loginMethod: "test",
      role: "admin",
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

describe("admin success-fee Stripe synchronization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockResolvedValue(mocks.mockDb);
    mocks.getAdminMemoryFallback.mockResolvedValue(null);
    mocks.selectLimit.mockResolvedValue([{
      id: 441,
      userId: 77,
      status: "active",
      stripeSubscriptionId: "sub_fee_441",
      notes: "Existing note",
      endDate: null,
    }]);
    mocks.stripeUpdate.mockResolvedValue({ id: "sub_fee_441" });
    mocks.stripeCancel.mockResolvedValue({ id: "sub_fee_441", status: "canceled" });
    mocks.updateWhere.mockResolvedValue([{ affectedRows: 1 }]);
  });

  it("records a local suspension only after Stripe confirms the billing pause", async () => {
    const caller = adminRouter.createCaller(createAdminContext(17));

    await expect(caller.updateFeeStatus({
      feeId: 441,
      status: "suspended",
      notes: "Verification is overdue.",
    })).resolves.toEqual({ success: true });

    expect(mocks.stripeUpdate).toHaveBeenCalledWith("sub_fee_441", {
      pause_collection: { behavior: "void" },
    });
    expect(mocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({
      status: "suspended",
      notes: "Verification is overdue.",
    }));
    expect(mocks.createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: "success_fee_status_updated",
      entityId: 441,
    }));
    expect(JSON.parse(mocks.createAuditEvent.mock.calls[0][0].afterState)).toMatchObject({
      status: "suspended",
      stripeSynchronization: "paused",
    });
  });

  it("pauses Stripe before recording a direct disputed-fee status", async () => {
    const caller = adminRouter.createCaller(createAdminContext(17));

    await expect(caller.updateFeeStatus({
      feeId: 441,
      status: "disputed",
    })).resolves.toEqual({ success: true });

    expect(mocks.stripeUpdate).toHaveBeenCalledWith("sub_fee_441", {
      pause_collection: { behavior: "void" },
    });
    expect(mocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: "disputed" }));
    expect(JSON.parse(mocks.createAuditEvent.mock.calls[0][0].afterState)).toMatchObject({
      status: "disputed",
      stripeSynchronization: "paused",
    });
  });

  it("cancels Stripe before recording a completed success-fee obligation", async () => {
    const caller = adminRouter.createCaller(createAdminContext(17));

    await expect(caller.updateFeeStatus({
      feeId: 441,
      status: "ended",
    })).resolves.toEqual({ success: true });

    expect(mocks.stripeCancel).toHaveBeenCalledWith("sub_fee_441");
    expect(mocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: "ended" }));
    expect(JSON.parse(mocks.createAuditEvent.mock.calls[0][0].afterState)).toMatchObject({
      status: "ended",
      stripeSynchronization: "cancelled",
    });
  });

  it("fails closed and opens a critical review when Stripe cannot pause billing", async () => {
    mocks.stripeUpdate.mockRejectedValueOnce(new Error("provider unavailable"));
    const caller = adminRouter.createCaller(createAdminContext(17));

    await expect(caller.updateFeeStatus({
      feeId: 441,
      status: "suspended",
    })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Stripe could not synchronize this billing change. The local fee status was not changed.",
    });

    expect(mocks.mockDb.update).not.toHaveBeenCalled();
    expect(mocks.createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: "success_fee_status_update_blocked_stripe_sync",
      entityId: 441,
      riskLevel: "critical",
    }));
    expect(JSON.parse(mocks.createAuditEvent.mock.calls[0][0].afterState)).toMatchObject({
      requestedStatus: "suspended",
      stripeSynchronization: "failed",
      localStatusChanged: false,
    });
    expect(mocks.createAdminReviewItem).toHaveBeenCalledWith(expect.objectContaining({
      entityId: 441,
      category: "payment_failed",
      priority: "critical",
    }));
  });
});
