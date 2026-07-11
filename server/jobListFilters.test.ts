import { describe, expect, it } from "vitest";
import { getActiveJobs } from "./db";

describe("canonical job list filters", () => {
  it("filters canonical jobs before pagination in the memory runtime", async () => {
    const jobs = await getActiveJobs(250, 0, {
      visaSponsorshipOnly: true,
      applicationProcess: "greenhouse",
    });

    expect(jobs.map((job) => job.id)).toEqual([1]);
  });

  it("keeps disclosed salary ranges that overlap the requested range", async () => {
    const matchingRanges = await getActiveJobs(250, 0, {
      remoteOnly: false,
      salaryRange: [100000, 140000],
    });
    const outsideRange = await getActiveJobs(250, 0, {
      remoteOnly: false,
      salaryRange: [175000, 200000],
    });

    expect(matchingRanges.map((job) => job.id)).toContain(3);
    expect(outsideRange.map((job) => job.id)).toContain(4);
    expect(outsideRange.map((job) => job.id)).not.toContain(3);
  });
});
