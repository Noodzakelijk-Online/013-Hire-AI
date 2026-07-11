import { describe, expect, it } from "vitest";
import { createApplication, getUserApplications, updateApplicationStatus } from "./db";

describe("application ownership boundaries", () => {
  it("does not allow one user to mutate another user's application", async () => {
    const ownerId = 61001;
    const otherUserId = 61002;
    const created = await createApplication({ userId: ownerId, jobId: 1, status: "pending" });
    const applicationId = Number(created.insertId);

    await expect(updateApplicationStatus(applicationId, "withdrawn", otherUserId))
      .rejects.toThrow("Application not found.");

    const ownerApplications = await getUserApplications(ownerId);
    const otherApplications = await getUserApplications(otherUserId);
    expect(ownerApplications.find((application) => application.id === applicationId)?.status).toBe("pending");
    expect(otherApplications.find((application) => application.id === applicationId)).toBeUndefined();
  });
});
