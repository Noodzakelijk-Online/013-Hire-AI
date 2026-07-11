import { describe, expect, it } from "vitest";
import {
  canTransitionApplicationStatus,
  canTransitionInterviewStatus,
} from "./applicationLifecycle";

describe("application lifecycle", () => {
  it("allows forward progress and idempotent updates", () => {
    expect(canTransitionApplicationStatus("pending", "applied")).toBe(true);
    expect(canTransitionApplicationStatus("applied", "interview")).toBe(true);
    expect(canTransitionApplicationStatus("offer", "accepted")).toBe(true);
    expect(canTransitionApplicationStatus("interview", "interview")).toBe(true);
  });

  it("prevents reopening terminal or submitted applications", () => {
    expect(canTransitionApplicationStatus("accepted", "pending")).toBe(false);
    expect(canTransitionApplicationStatus("withdrawn", "applied")).toBe(false);
    expect(canTransitionApplicationStatus("interview", "pending")).toBe(false);
  });
});

describe("interview lifecycle", () => {
  it("allows rescheduling and completion for active interviews", () => {
    expect(canTransitionInterviewStatus("scheduled", "rescheduled")).toBe(true);
    expect(canTransitionInterviewStatus("rescheduled", "completed")).toBe(true);
  });

  it("keeps completed and cancelled interviews terminal", () => {
    expect(canTransitionInterviewStatus("completed", "rescheduled")).toBe(false);
    expect(canTransitionInterviewStatus("cancelled", "scheduled")).toBe(false);
  });
});
