import { describe, expect, it } from "vitest";
import {
  getSavedJobs,
  saveJob,
  unsaveJob,
  updateSavedJobNotes,
} from "./applicationFeatures";

describe("saved jobs memory fallback", () => {
  it("supports save, update, list, and unsave without a configured database", async () => {
    const userId = 990_001;
    const jobId = 1;

    await unsaveJob(userId, jobId);

    const created = await saveJob({
      userId,
      jobId,
      notes: "Queued from review decision.",
      tags: "review-queue",
      priority: "high",
    });
    expect(created.updated).toBe(false);

    const updated = await saveJob({
      userId,
      jobId,
      notes: "Saved after user review.",
      priority: "medium",
    });
    expect(updated).toEqual({ id: created.id, updated: true });

    await updateSavedJobNotes(userId, jobId, "Ready for manual review.", "manual", "low");

    const saved = await getSavedJobs(userId);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      id: created.id,
      jobId,
      notes: "Ready for manual review.",
      tags: "manual",
      priority: "low",
    });
    expect(saved[0].job?.id).toBe(jobId);

    await unsaveJob(userId, jobId);
    expect(await getSavedJobs(userId)).toEqual([]);
  });
});
