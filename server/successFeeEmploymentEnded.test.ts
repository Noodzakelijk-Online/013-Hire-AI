import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { successFeesRouter } from "./routers/successFees";

const mocks = vi.hoisted(() => {
  const selectLimit = vi.fn();
  const insertValues = vi.fn();
  const updateWhere = vi.fn();
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const mockDb = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: selectLimit,
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: insertValues,
    })),
    update: vi.fn(() => ({
      set: updateSet,
    })),
  };
  const stripeCancel = vi.fn();

  return {
    mockDb,
    selectLimit,
    insertValues,
    updateSet,
    updateWhere,
    stripeCancel,
    createAdminReviewItem: vi.fn(),
    createAuditEvent: vi.fn(),
    getDb: vi.fn(),
    getUserOfferAttributionReviews: vi.fn(),
    storagePut: vi.fn(),
  };
});

vi.mock("./db", () => ({
  createAdminReviewItem: mocks.createAdminReviewItem,
  createAuditEvent: mocks.createAuditEvent,
  getDb: mocks.getDb,
  getUserOfferAttributionReviews: mocks.getUserOfferAttributionReviews,
}));

vi.mock("./storage", () => ({
  storagePut: mocks.storagePut,
}));

vi.mock("./stripeClient", () => ({
  getStripeClient: vi.fn(() => ({
    subscriptions: {
      cancel: mocks.stripeCancel,
    },
  })),
}));

function createContext(userId: number): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `employment-ended-user-${userId}`,
      name: "Employment Ended User",
      email: `employment-ended-${userId}@example.local`,
      loginMethod: "test",
      role: "user",
      stripeCustomerId: null,
      accountStatus: "active",
      tosAcceptedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("success fee employment-ended reporting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockResolvedValue(mocks.mockDb);
    mocks.selectLimit.mockResolvedValue([{
      id: 77,
      userId: 99117,
      applicationId: 441,
      employerName: "FinalLedger",
      jobTitle: "Remote Revenue Analyst",
      status: "active",
      endDate: null,
      stripeSubscriptionId: "sub_final_123",
    }]);
    mocks.insertValues.mockResolvedValue([{ insertId: 9901 }]);
    mocks.updateWhere.mockResolvedValue([{ affectedRows: 1 }]);
    mocks.stripeCancel.mockResolvedValue({ id: "sub_final_123", status: "canceled" });
  });

  it("cancels billing and opens an auditable admin review for final obligation closure", async () => {
    const caller = successFeesRouter.createCaller(createContext(99117));
    const result = await caller.reportEmploymentEnded({
      successFeeId: 77,
      endDate: "2026-07-15T00:00:00.000Z",
    });

    expect(result).toMatchObject({
      success: true,
      status: "pending_admin_review",
      stripeSubscriptionCancelled: true,
      approvalId: 9901,
    });
    expect(mocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({
      userId: 99117,
      applicationId: 441,
      entityType: "billing",
      entityId: 77,
      approvalType: "billing_action",
      status: "approved",
      riskLevel: "high",
      title: "Employment end reported",
    }));
    expect(mocks.stripeCancel).toHaveBeenCalledWith("sub_final_123");
    expect(mocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({
      status: "ended",
      endDate: new Date("2026-07-15T00:00:00.000Z"),
    }));
    expect(mocks.createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      userId: 99117,
      entityType: "success_fee",
      entityId: 77,
      action: "employment_ended_reported",
      actor: "user",
      source: "successFees.reportEmploymentEnded",
      riskLevel: "high",
      approvalId: 9901,
    }));
    expect(mocks.createAuditEvent.mock.calls[0][0].beforeState).toContain('"status":"active"');
    expect(mocks.createAuditEvent.mock.calls[0][0].afterState).toContain('"stripeSubscriptionCancelled":true');
    expect(mocks.createAdminReviewItem).toHaveBeenCalledWith(expect.objectContaining({
      userId: 99117,
      entityType: "success_fee",
      entityId: 77,
      category: "employment_ended",
      priority: "high",
      title: "Employment ended report needs review",
    }));
  });
});
