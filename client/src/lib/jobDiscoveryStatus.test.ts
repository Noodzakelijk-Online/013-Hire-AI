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
      sourcesWithSuccessfulScrape: 2,
      sourcesWithFreshScrape: 2,
      canonicalJobs: 11,
      latestSuccessfulScrapeAt: "2026-07-12T06:00:00.000Z",
    }, now);

    expect(summary.status).toBe("current");
    expect(summary.detail).toContain("successful scan in the last 24 hours");
  });

  it("does not represent one fresh source as complete multi-source coverage", () => {
    const summary = getJobDiscoveryStatusSummary({
      activeSources: 3,
      sourcesWithSuccessfulScrape: 2,
      sourcesWithFreshScrape: 1,
      sourcesAwaitingFirstScrape: 1,
      sourcesWithStaleScrape: 1,
      canonicalJobs: 11,
      latestSuccessfulScrapeAt: "2026-07-12T06:00:00.000Z",
    }, now);

    expect(summary.status).toBe("partial");
    expect(summary.label).toBe("Discovery coverage partial");
    expect(summary.detail).toContain("2 sources need a fresh scan");
  });

  it("never labels discovery current after a source's latest scan failed", () => {
    const summary = getJobDiscoveryStatusSummary({
      activeSources: 2,
      sourcesWithSuccessfulScrape: 2,
      sourcesWithFreshScrape: 2,
      sourcesWithFailedLatestScrape: 1,
      sourcesWithFreshFailedLatestScrape: 1,
      canonicalJobs: 11,
      latestSuccessfulScrapeAt: "2026-07-12T06:00:00.000Z",
    }, now);

    expect(summary.status).toBe("degraded");
    expect(summary.label).toBe("Discovery needs attention");
    expect(summary.detail).toContain("1 source failed");
  });

  it("surfaces a partial source scan without exposing source errors", () => {
    const summary = getJobDiscoveryStatusSummary({
      activeSources: 1,
      sourcesWithSuccessfulScrape: 1,
      sourcesWithFreshScrape: 1,
      sourcesWithPartialLatestScrape: 1,
      sourcesWithFreshPartialLatestScrape: 1,
      canonicalJobs: 2,
      latestSuccessfulScrapeAt: "2026-07-12T06:00:00.000Z",
    }, now);

    expect(summary.status).toBe("degraded");
    expect(summary.detail).toContain("1 source completed only partially");
  });

  it("surfaces a clean source scan with no observed listings as coverage attention", () => {
    const summary = getJobDiscoveryStatusSummary({
      activeSources: 2,
      sourcesWithSuccessfulScrape: 2,
      sourcesWithFreshScrape: 2,
      sourcesWithEmptyLatestScrape: 1,
      sourcesWithFreshEmptyLatestScrape: 1,
      canonicalJobs: 9,
      latestSuccessfulScrapeAt: "2026-07-12T06:00:00.000Z",
    }, now);

    expect(summary).toMatchObject({
      status: "degraded",
      label: "Discovery needs attention",
      sourcesWithEmptyLatestScrape: 1,
    });
    expect(summary.detail).toContain("1 source returned no listings");
  });

  it("does not preserve a current incident after its source evidence is stale", () => {
    const summary = getJobDiscoveryStatusSummary({
      activeSources: 2,
      sourcesWithSuccessfulScrape: 2,
      sourcesWithFreshScrape: 0,
      sourcesWithStaleScrape: 2,
      sourcesWithEmptyLatestScrape: 1,
      sourcesWithFreshEmptyLatestScrape: 0,
      canonicalJobs: 9,
      latestSuccessfulScrapeAt: "2026-07-11T06:00:00.000Z",
    }, now);

    expect(summary.status).toBe("stale");
    expect(summary.label).toBe("Discovery may be stale");
    expect(summary.sourcesWithEmptyLatestScrape).toBe(1);
    expect(summary.sourcesWithFreshEmptyLatestScrape).toBe(0);
  });
});
