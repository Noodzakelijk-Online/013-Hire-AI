import { describe, expect, it } from "vitest";
import { AutonomousExecutionGuard } from "./autonomousExecutionGuard";

describe("AutonomousExecutionGuard", () => {
  it("allows actions while the lease is active", () => {
    const guard = new AutonomousExecutionGuard();
    expect(() => guard.assertLeaseActive()).not.toThrow();
  });

  it("blocks subsequent actions after lease ownership is lost", () => {
    const guard = new AutonomousExecutionGuard();
    guard.markLeaseLost("Lease renewal failed.");
    expect(() => guard.assertLeaseActive()).toThrow("Lease renewal failed.");
  });
});
