import { describe, expect, it } from "vitest";
import { createSuccessFee, getAdminMemoryFallback } from "./db";

describe("admin memory fallback", () => {
  it("derives local admin statistics and fee rows from the in-memory ledger", async () => {
    const userId = 98401;
    const created = await createSuccessFee({
      userId,
      applicationId: 1,
      employerName: "Local Ledger Employer",
      jobTitle: "Evidence Engineer",
      monthlySalary: 9000,
      currency: "USD",
      feePercent: 5,
      monthlyFeeAmount: 45000,
      status: "active",
      startDate: new Date("2025-09-01T00:00:00.000Z"),
      nextVerificationDue: new Date("2026-01-01T00:00:00.000Z"),
      verificationGraceExpiry: new Date("2026-01-15T00:00:00.000Z"),
    });

    const fallback = await getAdminMemoryFallback();

    expect(fallback).not.toBeNull();
    expect(fallback?.stats.activeFees).toBeGreaterThan(0);
    expect(fallback?.stats.totalRevenueUsd).toBe(0);
    expect(fallback?.fees.some((fee) => fee.id === Number(created.insertId))).toBe(true);
    expect(fallback?.overdue.some((fee) =>
      fee.id === Number(created.insertId) && fee.daysOverdue > 0 && fee.graceExpired
    )).toBe(true);
    expect(fallback?.pendingVerifications).toEqual([]);
    expect(fallback?.payments).toEqual([]);
  });
});
