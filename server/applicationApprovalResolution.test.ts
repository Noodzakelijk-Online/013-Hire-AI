import { describe, expect, it } from "vitest";
import {
  getApplicationSubmissionGateAttemptStatus,
  getApplicationSubmissionGateAttemptText,
  shouldRecordApplicationSubmissionGateAttempt,
} from "./applicationApprovalResolution";

describe("application approval resolution helpers", () => {
  it("records only application submission gates with linked applications", () => {
    expect(shouldRecordApplicationSubmissionGateAttempt({
      approvalType: "application_submission",
      applicationId: 123,
    })).toBe(true);
    expect(shouldRecordApplicationSubmissionGateAttempt({
      approvalType: "follow_up_send",
      applicationId: 123,
    })).toBe(false);
    expect(shouldRecordApplicationSubmissionGateAttempt({
      approvalType: "application_submission",
      applicationId: null,
    })).toBe(false);
  });

  it("maps approval outcomes to safe attempt statuses", () => {
    expect(getApplicationSubmissionGateAttemptStatus("approved")).toBe("prepared");
    expect(getApplicationSubmissionGateAttemptStatus("rejected")).toBe("cancelled");
    expect(getApplicationSubmissionGateAttemptStatus("cancelled")).toBe("cancelled");
  });

  it("creates explicit non-submission ledger text", () => {
    expect(getApplicationSubmissionGateAttemptText({
      approvalType: "application_submission",
      title: "Approve prepared external submission",
      description: "Prepared materials require review.",
    }, "approved", "Looks ready for manual submit.")).toContain(
      "No external submission was recorded by this approval."
    );
    expect(getApplicationSubmissionGateAttemptText({
      approvalType: "application_submission",
      title: "Approve prepared external submission",
      description: null,
    }, "rejected")).toContain("external handoff is cancelled");
  });
});
