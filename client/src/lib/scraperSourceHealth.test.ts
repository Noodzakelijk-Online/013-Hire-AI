import { describe, expect, it } from "vitest";
import {
  getScraperSourceHealthSummary,
  getScraperSourceOutcomeCounts,
} from "./scraperSourceHealth";

describe("scraper source health", () => {
  it("distinguishes a failed latest source run from a clean one", () => {
    expect(getScraperSourceHealthSummary({
      lastScrapeStatus: "failed",
      lastScrapeJobCount: 0,
      lastScrapeError: "HTTP 429 from source",
    })).toMatchObject({
      outcome: "failed",
      label: "Failed",
      jobCount: 0,
      error: "HTTP 429 from source",
    });

    expect(getScraperSourceHealthSummary({
      lastScrapeStatus: "success",
      lastScrapeJobCount: 14,
      lastScrapeError: "stale error that must not be displayed",
    })).toMatchObject({
      outcome: "success",
      label: "Succeeded",
      jobCount: 14,
      error: null,
    });
  });

  it("keeps unrecorded legacy state awaiting a verified run", () => {
    expect(getScraperSourceHealthSummary({})).toMatchObject({
      outcome: "awaiting",
      label: "Awaiting scan",
      jobCount: null,
    });
  });

  it("does not treat a zero-listing success as discovery coverage", () => {
    expect(getScraperSourceHealthSummary({
      lastScrapeStatus: "success",
      lastScrapeJobCount: 0,
    })).toMatchObject({
      outcome: "empty",
      label: "No listings observed",
      jobCount: 0,
      error: null,
    });
  });

  it("counts empty, partial, and failed sources as attention items", () => {
    expect(getScraperSourceOutcomeCounts([
      { lastScrapeStatus: "success", lastScrapeJobCount: 4 },
      { lastScrapeStatus: "success", lastScrapeJobCount: 0 },
      { lastScrapeStatus: "partial" },
      { lastScrapeStatus: "failed" },
      {},
    ])).toEqual({
      success: 1,
      empty: 1,
      partial: 1,
      failed: 1,
      awaiting: 1,
      issues: 3,
    });
  });
});
