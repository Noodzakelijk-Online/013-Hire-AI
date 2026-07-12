import { afterEach, describe, expect, it } from "vitest";
import { searchJobs } from "./db";
import { sampleJobs } from "./sampleData";

const injectedJobIds: number[] = [];

afterEach(() => {
  for (const id of injectedJobIds.splice(0)) {
    const index = sampleJobs.findIndex((job) => job.id === id);
    if (index >= 0) sampleJobs.splice(index, 1);
  }
});

describe("job search availability", () => {
  it("does not return an expired listing that otherwise matches the query", async () => {
    const expiredJob = {
      ...sampleJobs[0],
      id: 989901,
      externalId: "expired-search-regression",
      title: "Expired Search Regression Engineer",
      company: "Expired Search Co",
      expiryDate: new Date(Date.now() - 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    sampleJobs.push(expiredJob);
    injectedJobIds.push(expiredJob.id);

    const results = await searchJobs({ title: "Expired Search Regression" });

    expect(results.some((job) => job.id === expiredJob.id)).toBe(false);
  });
});
