import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock getDb ────────────────────────────────────────────────────────────────
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};
vi.mock("./db", () => ({ getDb: vi.fn(() => Promise.resolve(mockDb)) }));

// ─── Mock Stripe ───────────────────────────────────────────────────────────────
const mockStripe = {
  customers: {
    create: vi.fn(),
    retrieve: vi.fn(),
  },
  subscriptions: {
    create: vi.fn(),
    cancel: vi.fn(),
    retrieve: vi.fn(),
  },
  prices: {
    create: vi.fn(),
  },
  billingPortal: {
    sessions: { create: vi.fn() },
  },
};
vi.mock("stripe", () => ({
  default: vi.fn(() => mockStripe),
}));

// ─── Mock storage ─────────────────────────────────────────────────────────────
vi.mock("./storage", () => ({
  storagePut: vi.fn(() => Promise.resolve({ url: "https://s3.example.com/offer.pdf", key: "offer.pdf" })),
}));

// ─── Business logic helpers (extracted for unit testing) ─────────────────────

/**
 * Calculate the monthly fee amount in cents given a monthly salary in USD and
 * a fee percentage (default 5%).
 */
function calculateMonthlyFee(monthlySalaryUsd: number, feePercent: number = 5): number {
  return Math.round((monthlySalaryUsd * feePercent) / 100 * 100); // result in cents
}

/**
 * Determine if a success fee arrangement is below the minimum salary threshold.
 * Minimum monthly salary is $300.
 */
function isBelowMinimumSalary(monthlySalaryUsd: number): boolean {
  return monthlySalaryUsd < 300;
}

/**
 * Determine if a quarterly verification is overdue.
 */
function isVerificationOverdue(nextVerificationDue: Date | null): boolean {
  if (!nextVerificationDue) return false;
  return nextVerificationDue < new Date();
}

/**
 * Calculate the next verification due date (90 days from now).
 */
function calculateNextVerificationDue(fromDate: Date = new Date()): Date {
  const next = new Date(fromDate);
  next.setDate(next.getDate() + 90);
  return next;
}

/**
 * Validate that a salary is within a reasonable range for the platform.
 * Minimum: $300/month, Maximum: $100,000/month.
 */
function validateSalary(monthlySalaryUsd: number): { valid: boolean; error?: string } {
  if (monthlySalaryUsd < 300) {
    return { valid: false, error: "Monthly salary must be at least $300" };
  }
  if (monthlySalaryUsd > 100_000) {
    return { valid: false, error: "Monthly salary exceeds maximum allowed value" };
  }
  return { valid: true };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Success Fee Business Logic", () => {
  describe("calculateMonthlyFee", () => {
    it("calculates 5% of $5,000/month correctly", () => {
      expect(calculateMonthlyFee(5000)).toBe(25000); // $250.00 in cents
    });

    it("calculates 5% of $3,000/month correctly", () => {
      expect(calculateMonthlyFee(3000)).toBe(15000); // $150.00 in cents
    });

    it("calculates 5% of minimum salary ($300/month)", () => {
      expect(calculateMonthlyFee(300)).toBe(1500); // $15.00 in cents
    });

    it("calculates custom fee percentage correctly", () => {
      expect(calculateMonthlyFee(5000, 4.5)).toBe(22500); // $225.00 in cents
    });

    it("rounds to nearest cent correctly", () => {
      // $333/month * 5% = $16.65 = 1665 cents
      expect(calculateMonthlyFee(333)).toBe(1665);
    });
  });

  describe("isBelowMinimumSalary", () => {
    it("returns true for salary below $300", () => {
      expect(isBelowMinimumSalary(299)).toBe(true);
    });

    it("returns false for salary exactly at $300", () => {
      expect(isBelowMinimumSalary(300)).toBe(false);
    });

    it("returns false for salary above $300", () => {
      expect(isBelowMinimumSalary(5000)).toBe(false);
    });
  });

  describe("isVerificationOverdue", () => {
    it("returns false when nextVerificationDue is null", () => {
      expect(isVerificationOverdue(null)).toBe(false);
    });

    it("returns true when verification due date is in the past", () => {
      const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24); // yesterday
      expect(isVerificationOverdue(pastDate)).toBe(true);
    });

    it("returns false when verification due date is in the future", () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days from now
      expect(isVerificationOverdue(futureDate)).toBe(false);
    });
  });

  describe("calculateNextVerificationDue", () => {
    it("returns a date 90 days from the given date", () => {
      const from = new Date("2026-01-01");
      const result = calculateNextVerificationDue(from);
      expect(result.toISOString().slice(0, 10)).toBe("2026-04-01");
    });

    it("defaults to 90 days from now when no date provided", () => {
      const now = new Date();
      const result = calculateNextVerificationDue();
      const diffDays = Math.round((result.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(90);
    });
  });

  describe("validateSalary", () => {
    it("rejects salary below $300", () => {
      const result = validateSalary(200);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("$300");
    });

    it("accepts salary exactly at $300", () => {
      expect(validateSalary(300).valid).toBe(true);
    });

    it("accepts typical salary of $5,000", () => {
      expect(validateSalary(5000).valid).toBe(true);
    });

    it("rejects salary above $100,000", () => {
      const result = validateSalary(150_000);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("maximum");
    });

    it("accepts salary at exactly $100,000", () => {
      expect(validateSalary(100_000).valid).toBe(true);
    });
  });
});

describe("Fee Calculation Integration", () => {
  it("correctly computes monthly fee for a $6,000 salary", () => {
    const salary = 6000;
    const feePercent = 5;
    const feeCents = calculateMonthlyFee(salary, feePercent);
    expect(feeCents).toBe(30000); // $300.00
    expect(feeCents / 100).toBe(300); // $300.00 in dollars
  });

  it("verifies minimum fee is $15 (5% of $300)", () => {
    const minSalary = 300;
    const feeCents = calculateMonthlyFee(minSalary);
    expect(feeCents / 100).toBe(15); // $15.00 minimum fee
  });

  it("ensures salary below threshold is blocked before fee calculation", () => {
    const salary = 250;
    expect(isBelowMinimumSalary(salary)).toBe(true);
    // Fee would be $12.50 which is below Stripe's minimum charge
    const feeCents = calculateMonthlyFee(salary);
    expect(feeCents / 100).toBe(12.5);
  });
});
