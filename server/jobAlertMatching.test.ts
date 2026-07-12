import { describe, expect, it } from "vitest";
import { matchesJobAlert } from "../shared/jobAlertMatching";

const remoteFrontendJob = {
  title: "Senior TypeScript Engineer",
  company: "Acme",
  description: "Build React applications for distributed teams.",
  location: "Remote - Europe",
  platformId: 18,
  platformName: "Remote OK",
  jobType: "full-time",
  salaryMin: 110000,
  salaryMax: 140000,
};

describe("matchesJobAlert", () => {
  it("requires every comma-separated keyword while allowing configured alternatives", () => {
    expect(matchesJobAlert(remoteFrontendJob, {
      keywords: "TypeScript, React",
      locations: "United States, Europe",
      platforms: "18, We Work Remotely",
      minSalary: 120000,
      jobTypes: "contract, full-time",
    })).toBe(true);
  });

  it("accepts array criteria for real-time discovery and requires a configured platform ID", () => {
    expect(matchesJobAlert(remoteFrontendJob, {
      keywords: ["TypeScript", "React"],
      locations: ["Europe"],
      platformIds: [18],
      minSalary: 120000,
      jobTypes: ["full-time"],
    })).toBe(true);

    expect(matchesJobAlert(remoteFrontendJob, { platformIds: [19] })).toBe(false);
  });

  it.each([
    [{ keywords: "Go" }, "keywords"],
    [{ locations: "Asia" }, "locations"],
    [{ platforms: "LinkedIn" }, "platforms"],
    [{ minSalary: 150000 }, "minimum salary"],
    [{ jobTypes: "contract" }, "job type"],
  ])("rejects a job that misses the %s criterion", (criteria) => {
    expect(matchesJobAlert(remoteFrontendJob, criteria)).toBe(false);
  });
});
