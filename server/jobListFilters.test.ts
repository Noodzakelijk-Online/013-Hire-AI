import { afterEach, describe, expect, it } from "vitest";
import { getActiveJobs } from "./db";
import { sampleJobs } from "./sampleData";

const injectedJobIds: number[] = [];

afterEach(() => {
  for (const id of injectedJobIds.splice(0)) {
    const index = sampleJobs.findIndex((job) => job.id === id);
    if (index >= 0) sampleJobs.splice(index, 1);
  }
});

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

  it("excludes no-expiry listings that are no longer observed by their source", async () => {
    const staleJob = {
      ...sampleJobs[0],
      id: 989903,
      externalId: "stale-list-regression",
      title: "Stale List Regression Engineer",
      company: "Stale List Co",
      expiryDate: null,
      createdAt: new Date(Date.now() - 16 * 86400000),
      updatedAt: new Date(Date.now() - 15 * 86400000),
    };
    sampleJobs.push(staleJob);
    injectedJobIds.push(staleJob.id);

    const jobs = await getActiveJobs(250, 0, { query: "Stale List Regression" });

    expect(jobs.some((job) => job.id === staleJob.id)).toBe(false);
  });
});
