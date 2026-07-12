import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { successFeesRouter } from "./routers/successFees";

const mocks = vi.hoisted(() => {
  const selectLimit = vi.fn();
  const selectOrderLimit = vi.fn();
  const storagePut = vi.fn();
  const dismissOfferAttributionAdminReviews = vi.fn();
  const insertResult = [{ insertId: 88 }];
  Object.assign(insertResult, {
    $returningId: vi.fn().mockResolvedValue([{ id: 77 }]),
  });
  const mockDb = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: selectLimit,
          orderBy: vi.fn(() => ({
            limit: selectOrderLimit,
          })),
        })),
      })),
    })),
    insert: vi.fn(() => ({ values: vi.fn(() => insertResult) })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([{ affectedRows: 1 }]) })),
    })),
  };

  return {
    mockDb,
    selectLimit,
    selectOrderLimit,
    storagePut,
    getDb: vi.fn(),
    createAdminReviewItem: vi.fn(),
    createAuditEvent: vi.fn(),
    dismissOfferAttributionAdminReviews,
    getUserOfferAttributionReviews: vi.fn(),
  };
});

vi.mock("./db", () => ({
  getDb: mocks.getDb,
  createAdminReviewItem: mocks.createAdminReviewItem,
  createAuditEvent: mocks.createAuditEvent,
  dismissOfferAttributionAdminReviews: mocks.dismissOfferAttributionAdminReviews,
  getUserOfferAttributionReviews: mocks.getUserOfferAttributionReviews,
}));

vi.mock("./storage", () => ({ storagePut: mocks.storagePut }));

vi.mock("./stripeClient", () => ({
  getStripeClient: vi.fn(() => ({
    customers: { create: vi.fn() },
    products: { create: vi.fn().mockResolvedValue({ id: "prod_test" }) },
    prices: { create: vi.fn().mockResolvedValue({ id: "price_test" }) },
    subscriptions: {
      create: vi.fn().mockResolvedValue({
        id: "sub_test",
        status: "incomplete",
        latest_invoice: { payment_intent: { client_secret: "secret_test" } },
      }),
    },
  })),
}));

function createContext(userId: number): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `success-fee-eligibility-${userId}`,
      email: `success-fee-eligibility-${userId}@example.local`,
      name: "Success Fee Eligibility User",
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

describe("success fee report-hire eligibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockResolvedValue(mocks.mockDb);
    mocks.selectLimit.mockResolvedValue([{ id: 51, status: "pending" }]);
    mocks.selectOrderLimit.mockResolvedValue([]);
    mocks.dismissOfferAttributionAdminReviews.mockResolvedValue({ dismissedReviewIds: [] });
  });

  it("rejects a linked application before uploading proof or creating billing state when no offer exists", async () => {
    const caller = successFeesRouter.createCaller(createContext(190091));

    await expect(caller.reportHire({
      employerName: "Example Employer",
      jobTitle: "Example Role",
      monthlySalary: 5000,
      currency: "USD",
      startDate: "2026-07-10",
      applicationId: 51,
      offerLetterBase64: "cHJvb2Y=",
      offerLetterMimeType: "text/plain",
      offerLetterFileName: "offer.txt",
      termsAccepted: true,
    })).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("confirms offer acceptance"),
    });

    expect(mocks.storagePut).not.toHaveBeenCalled();
  });

  it("rejects a linked unaccepted offer before uploading proof or creating billing state", async () => {
    mocks.selectLimit.mockResolvedValue([{ id: 51, status: "offer" }]);
    const caller = successFeesRouter.createCaller(createContext(190093));

    await expect(caller.reportHire({
      employerName: "Example Employer",
      jobTitle: "Example Role",
      monthlySalary: 5000,
      currency: "USD",
      startDate: "2026-07-10",
      applicationId: 51,
      offerLetterBase64: "cHJvb2Y=",
      offerLetterMimeType: "text/plain",
      offerLetterFileName: "offer.txt",
      termsAccepted: true,
    })).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("confirms offer acceptance"),
    });

    expect(mocks.storagePut).not.toHaveBeenCalled();
    expect(mocks.mockDb.insert).not.toHaveBeenCalled();
  });

  it("rejects a cancelled or rejected attribution before proof upload or success-fee creation", async () => {
    mocks.selectLimit.mockResolvedValue([{ id: 51, status: "accepted" }]);
    mocks.selectOrderLimit.mockResolvedValue([{ id: 77, status: "rejected" }]);
    const caller = successFeesRouter.createCaller(createContext(190092));

    await expect(caller.reportHire({
      employerName: "Example Employer",
      jobTitle: "Example Role",
      monthlySalary: 5000,
      currency: "USD",
      startDate: "2026-07-10",
      applicationId: 51,
      offerLetterBase64: "cHJvb2Y=",
      offerLetterMimeType: "text/plain",
      offerLetterFileName: "offer.txt",
      termsAccepted: true,
    })).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("rejected or cancelled"),
    });

    expect(mocks.storagePut).not.toHaveBeenCalled();
    expect(mocks.mockDb.insert).not.toHaveBeenCalled();
  });

  it("rejects a duplicate hire report while the employer fee is suspended", async () => {
    mocks.selectLimit
      .mockResolvedValueOnce([{ id: 51, status: "accepted" }])
      .mockResolvedValueOnce([{ id: 77, status: "suspended" }]);
    mocks.selectOrderLimit.mockResolvedValueOnce([]);
    const caller = successFeesRouter.createCaller(createContext(190095));

    await expect(caller.reportHire({
      employerName: "Example Employer",
      jobTitle: "Example Role",
      monthlySalary: 5000,
      currency: "USD",
      startDate: "2026-07-10",
      applicationId: 51,
      offerLetterBase64: "cHJvb2Y=",
      offerLetterMimeType: "text/plain",
      offerLetterFileName: "offer.txt",
      termsAccepted: true,
    })).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("unresolved"),
    });

    expect(mocks.storagePut).not.toHaveBeenCalled();
    expect(mocks.mockDb.insert).not.toHaveBeenCalled();
  });

  it("supersedes the source offer review when a linked accepted hire is reported", async () => {
    mocks.selectLimit
      .mockResolvedValueOnce([{ id: 51, status: "accepted" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 1, stripeCustomerId: "cus_test" }]);
    mocks.selectOrderLimit.mockResolvedValueOnce([{ id: 77, status: "pending" }]);
    mocks.dismissOfferAttributionAdminReviews.mockResolvedValue({ dismissedReviewIds: [901] });
    const caller = successFeesRouter.createCaller(createContext(190094));

    await expect(caller.reportHire({
      employerName: "Example Employer",
      jobTitle: "Example Role",
      monthlySalary: 5000,
      currency: "USD",
      startDate: "2026-07-10",
      applicationId: 51,
      offerLetterBase64: Buffer.from("%PDF-1.4\nreport-hire-proof").toString("base64"),
      offerLetterMimeType: "application/pdf",
      offerLetterFileName: "offer.pdf",
      termsAccepted: true,
    })).resolves.toMatchObject({ feeId: 77 });

    expect(mocks.dismissOfferAttributionAdminReviews).toHaveBeenCalledWith(
      190094,
      51,
      expect.stringContaining("Superseded by the user's report-hire flow")
    );
    expect(mocks.createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      entityType: "application",
      entityId: 51,
      action: "offer_attribution_review_superseded_by_hire_report",
      approvalId: 77,
    }));
  });
});
