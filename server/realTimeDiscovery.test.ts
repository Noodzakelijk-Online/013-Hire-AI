import { describe, expect, it } from "vitest";
import { selectCanonicalDiscoveryJobs } from "./realTimeDiscovery";

describe("canonical job discovery", () => {
  it("removes linked duplicate rows from subscriber payloads without changing canonical listing details", () => {
    const canonical = {
      id: 1,
      title: "Senior Software Engineer",
      company: "Acme",
      location: "Remote",
      salaryMin: 120000,
      salaryMax: 160000,
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
