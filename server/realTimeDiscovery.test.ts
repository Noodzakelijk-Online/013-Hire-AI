import { describe, expect, it } from "vitest";
import { filterDiscoveryJobs, getRecentJobs, jobMatchesAlert, selectCanonicalDiscoveryJobs } from "./realTimeDiscovery";

describe("canonical job discovery", () => {
  it("removes linked duplicate rows from subscriber payloads without changing canonical listing details", () => {
    const canonical = {
      id: 1,
      title: "Senior Software Engineer",
      company: "Acme",
      location: "Remote",
      salaryMin: 120000,
      salaryMax: 160000,
      jobType: "full-time" as const,
      platformId: 1,
      postedDate: new Date("2026-07-10T08:00:00.000Z"),
      createdAt: new Date("2026-07-10T09:00:00.000Z"),
      isDuplicate: 0,
    };
    const duplicate = {
      ...canonical,
      id: 2,
      platformId: 2,
      createdAt: new Date("2026-07-10T09:01:00.000Z"),
      isDuplicate: 1,
    };

    expect(selectCanonicalDiscoveryJobs([canonical, duplicate])).toEqual([
      expect.objectContaining({ id: 1, platformId: 1 }),
    ]);
    expect(selectCanonicalDiscoveryJobs([canonical, duplicate])[0]).not.toHaveProperty("isDuplicate");
    expect(selectCanonicalDiscoveryJobs([canonical, duplicate])[0]).not.toHaveProperty("createdAt");
  });
});

const remoteTypeScriptJob = {
  id: 91,
  title: "Senior TypeScript Engineer",
  company: "Acme",
  location: "Remote - Europe",
  salaryMin: 100000,
  salaryMax: 140000,
  jobType: "full-time" as const,
  platformId: 18,
  postedDate: new Date("2026-07-10T08:00:00.000Z"),
};

describe("real-time discovery filtering", () => {
  it("applies job type to the local discovery query", async () => {
    const result = await getRecentJobs({ jobTypes: ["contract"] });

    expect(result.total).toBeGreaterThan(0);
    expect(result.jobs).toEqual(expect.arrayContaining([
      expect.objectContaining({ jobType: "contract" }),
    ]));
    expect(result.jobs.every((job) => job.jobType === "contract")).toBe(true);
  });

  it("applies job type and requires evidence for constrained location and salary filters", () => {
    const unknownJob = {
      ...remoteTypeScriptJob,
      id: 92,
      location: null,
      salaryMin: null,
      salaryMax: null,
      jobType: "contract" as const,
    };

    expect(filterDiscoveryJobs([remoteTypeScriptJob, unknownJob], {
      keywords: ["TypeScript"],
      locations: ["Europe"],
      platformIds: [18],
      minSalary: 120000,
      jobTypes: ["full-time"],
    })).toEqual([remoteTypeScriptJob]);
  });

  it("uses the shared alert policy for keyword, platform, salary, and job type criteria", () => {
    expect(jobMatchesAlert(remoteTypeScriptJob, {
      id: 501,
      userId: 8,
      name: "TypeScript remote roles",
      keywords: ["TypeScript", "Engineer"],
      locations: ["Europe"],
      platformIds: [18],
      minSalary: 120000,
      jobTypes: ["full-time"],
      frequency: "daily",
      isActive: true,
      lastTriggered: null,
      createdAt: new Date("2026-07-10T08:00:00.000Z"),
    })).toBe(true);

    expect(jobMatchesAlert(remoteTypeScriptJob, {
      id: 502,
      userId: 8,
      name: "Contract roles",
      keywords: [],
      locations: [],
      platformIds: [],
      minSalary: null,
      jobTypes: ["contract"],
      frequency: "daily",
      isActive: true,
      lastTriggered: null,
      createdAt: new Date("2026-07-10T08:00:00.000Z"),
    })).toBe(false);
  });
});
