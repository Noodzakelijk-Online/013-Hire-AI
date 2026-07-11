import { describe, expect, it } from "vitest";
import { assertSuccessFeeTransition, canTransitionSuccessFeeStatus } from "./successFeeStateMachine";

describe("success-fee state machine", () => {
  it("allows payment recovery while preventing ended fees from resuming", () => {
    expect(canTransitionSuccessFeeStatus("suspended", "active")).toBe(true);
    expect(canTransitionSuccessFeeStatus("ended", "active")).toBe(false);
    expect(() => assertSuccessFeeTransition("ended", "active")).toThrow("Invalid success-fee transition");
  });
});
