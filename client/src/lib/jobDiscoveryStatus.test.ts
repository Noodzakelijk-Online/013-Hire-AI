import { describe, expect, it } from "vitest";
import { getJobDiscoveryStatusSummary } from "./jobDiscoveryStatus";

const now = new Date("2026-07-12T12:00:00.000Z");

describe("job discovery status summary", () => {
  it("reports unavailable when no active source is configured", () => {
    const summary = getJobDiscoveryStatusSummary({ activeSources: 0, canonicalJobs: 0 }, now);

    expect(summary.status).toBe("no_active_sources");
    expect(summary.label).toBe("Discovery unavailable");
  });

  it("does not treat existing listings as evidence of a successful scan", () => {
    const summary = getJobDiscoveryStatusSummary({
      activeSources: 8,
      sourcesWithSuccessfulScrape: 0,
      canonicalJobs: 4,
      latestSuccessfulScrapeAt: null,
    }, now);

    expect(summary.status).toBe("awaiting_first_scan");
    expect(summary.detail).toContain("no successful scan timestamp");
    expect(summary.detail).toContain("4 canonical jobs");
  });

  it("flags a scan older than 24 hours as stale", () => {
    const summary = getJobDiscoveryStatusSummary({
      activeSources: 2,
      sourcesWithSuccessfulScrape: 2,
      canonicalJobs: 11,
      latestSuccessfulScrapeAt: new Date("2026-07-11T11:59:59.000Z"),
    }, now);

    expect(summary.status).toBe("stale");
    expect(summary.detail).toContain("more than 24 hours ago");
  });

  it("reports current when a successful scan is within 24 hours", () => {
    const summary = getJobDiscoveryStatusSummary({
      activeSources: 2,
      sourcesWithSuccessfulScrape: 1,
      canonicalJobs: 11,
      latestSuccessfulScrapeAt: "2026-07-12T06:00:00.000Z",
    }, now);

    expect(summary.status).toBe("current");
    expect(summary.detail).toContain("successful scan in the last 24 hours");
  });
});
