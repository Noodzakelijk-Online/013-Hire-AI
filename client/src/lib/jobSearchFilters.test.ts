import { describe, expect, it } from "vitest";
import {
  countActiveJobSearchFilters,
  defaultJobSearchFilters,
  filterJobListings,
} from "./jobSearchFilters";

const jobs = [
  {
    id: 1,
    title: "Senior Full Stack Engineer",
    company: "Northstar",
    description: "Build remote TypeScript products.",
    requirements: "5+ years React and TypeScript",
    location: "Remote - Worldwide",
    jobType: "full-time",
    platformId: 1,
    salaryMin: 120000,
    salaryMax: 160000,
    applicationProcess: "greenhouse",
    visaSponsorshipAvailable: 1,
    openHiringSupport: 1,
    diversityFriendly: 1,
    postedDate: new Date("2026-07-09T12:00:00.000Z"),
  },
  {
    id: 2,
    title: "Junior Frontend Engineer",
    company: "Studio",
    description: "React and accessibility work.",
    requirements: "2+ years CSS",
    location: "Remote - US Only",
    jobType: "full-time",
    platformId: 2,
    salaryMin: 70000,
    salaryMax: 95000,
    applicationProcess: "lever",
    visaSponsorshipAvailable: 0,
    openHiringSupport: 0,
    diversityFriendly: 1,
    postedDate: new Date("2026-06-01T12:00:00.000Z"),
  },
  {
    id: 3,
    title: "Staff Platform Engineer",
    company: "Office Only",
    description: "Kubernetes platform work.",
    requirements: "8+ years infrastructure experience",
    location: "Amsterdam, Netherlands",
    jobType: "contract",
    platformId: 3,
    salaryMin: null,
    salaryMax: null,
    applicationProcess: "workday",
    visaSponsorshipAvailable: 1,
    openHiringSupport: 0,
    diversityFriendly: 0,
    postedDate: new Date("2026-07-08T12:00:00.000Z"),
  },
];

describe("job search filters", () => {
  it("keeps jobs whose salary range overlaps the target range", () => {
    const result = filterJobListings(jobs, {
      ...defaultJobSearchFilters,
      remoteOnly: false,
      salaryRange: [100000, 140000],
    }, new Date("2026-07-10T12:00:00.000Z"));

    expect(result.map((job) => job.id)).toEqual([1, 3]);
  });

  it("combines evidence, ATS, recency, and experience filters", () => {
    const result = filterJobListings(jobs, {
      ...defaultJobSearchFilters,
      visaSponsorshipOnly: true,
      openHiringSupportOnly: true,
      diversityFriendlyOnly: true,
      applicationProcess: "greenhouse",
      experienceLevel: "senior",
      postedWithin: "3",
    }, new Date("2026-07-10T12:00:00.000Z"));

    expect(result.map((job) => job.id)).toEqual([1]);
  });

  it("does not treat unknown salary as a failed range unless disclosure is required", () => {
    const included = filterJobListings(jobs, {
      ...defaultJobSearchFilters,
      remoteOnly: false,
      salaryRange: [100000, 140000],
    }, new Date("2026-07-10T12:00:00.000Z"));
    const disclosedOnly = filterJobListings(jobs, {
      ...defaultJobSearchFilters,
      remoteOnly: false,
      salaryRange: [100000, 140000],
      salaryDisclosedOnly: true,
    }, new Date("2026-07-10T12:00:00.000Z"));

    expect(included.map((job) => job.id)).toContain(3);
    expect(disclosedOnly.map((job) => job.id)).not.toContain(3);
  });

  it("counts only filters that differ from the safe defaults", () => {
    expect(countActiveJobSearchFilters(defaultJobSearchFilters)).toBe(0);
    expect(countActiveJobSearchFilters({
      ...defaultJobSearchFilters,
      remoteOnly: false,
      postedWithin: "7",
    })).toBe(2);
  });
});
