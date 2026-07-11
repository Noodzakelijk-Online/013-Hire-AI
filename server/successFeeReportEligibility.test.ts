import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { successFeesRouter } from "./routers/successFees";

const mocks = vi.hoisted(() => {
  const selectLimit = vi.fn();
  const selectOrderLimit = vi.fn();
  const storagePut = vi.fn();
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
    insert: vi.fn(),
  };

  return {
    mockDb,
    selectLimit,
    selectOrderLimit,
    storagePut,
    getDb: vi.fn(),
    createAdminReviewItem: vi.fn(),
    createAuditEvent: vi.fn(),
    getUserOfferAttributionReviews: vi.fn(),
  };
});

vi.mock("./db", () => ({
  getDb: mocks.getDb,
  createAdminReviewItem: mocks.createAdminReviewItem,
  createAuditEvent: mocks.createAuditEvent,
  getUserOfferAttributionReviews: mocks.getUserOfferAttributionReviews,
}));

vi.mock("./storage", () => ({ storagePut: mocks.storagePut }));

vi.mock("./stripeClient", () => ({ getStripeClient: vi.fn(() => ({})) }));

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
      message: expect.stringContaining("offer is recorded"),
    });

    expect(mocks.storagePut).not.toHaveBeenCalled();
  });

  it("rejects a cancelled or rejected attribution before proof upload or success-fee creation", async () => {
    mocks.selectLimit.mockResolvedValue([{ id: 51, status: "offer" }]);
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
});
