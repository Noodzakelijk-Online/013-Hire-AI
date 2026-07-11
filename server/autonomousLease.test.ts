import { describe, expect, it } from "vitest";
import {
  acquireAutonomousRunLease,
  completeAutonomousRunLease,
} from "./db";

describe("autonomous run leases", () => {
  it("prevents concurrent runs for the same user", async () => {
    const userId = 91001;

    expect(await acquireAutonomousRunLease(userId, "first", 0)).toBe(true);
    expect(await acquireAutonomousRunLease(userId, "second", 0)).toBe(false);
    expect(await completeAutonomousRunLease(userId, "stale")).toBe(false);
    expect(await acquireAutonomousRunLease(userId, "second", 0)).toBe(false);

    expect(await completeAutonomousRunLease(userId, "first")).toBe(true);
    expect(await acquireAutonomousRunLease(userId, "third", 0)).toBe(true);
    expect(await completeAutonomousRunLease(userId, "third")).toBe(true);
  });

  it("enforces the schedule interval after a successful run", async () => {
    const userId = 91002;

    expect(await acquireAutonomousRunLease(userId, "first", 60_000)).toBe(true);
    await completeAutonomousRunLease(userId, "first");

    expect(await acquireAutonomousRunLease(userId, "second", 60_000)).toBe(false);
    expect(await acquireAutonomousRunLease(userId, "manual", 0)).toBe(true);
    await completeAutonomousRunLease(userId, "manual");
  });

  it("allows failed scheduled runs to retry", async () => {
    const userId = 91003;

    expect(await acquireAutonomousRunLease(userId, "first", 60_000)).toBe(true);
    await completeAutonomousRunLease(userId, "first", "Temporary failure");

    expect(await acquireAutonomousRunLease(userId, "retry", 60_000)).toBe(true);
    await completeAutonomousRunLease(userId, "retry");
  });

  it("allows an opted-out preflight run to release without starting its interval", async () => {
    const userId = 91004;

    expect(await acquireAutonomousRunLease(userId, "preflight", 60_000)).toBe(true);
    expect(
      await completeAutonomousRunLease(userId, "preflight", "Autonomous scheduling was disabled.")
    ).toBe(true);
    expect(await acquireAutonomousRunLease(userId, "reenabled", 60_000)).toBe(true);
    await completeAutonomousRunLease(userId, "reenabled");
  });
});
