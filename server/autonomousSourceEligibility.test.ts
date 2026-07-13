import { describe, expect, it } from "vitest";
import {
  EMPTY_SOURCE_SCAN_REASON,
  EMPTY_SOURCE_SCAN_FRESHNESS_MS,
  getAutonomousSourceEligibility,
} from "./autonomousSourceEligibility";

describe("autonomous source eligibility", () => {
  const now = new Date("2026-07-13T12:00:00.000Z");

  it("blocks preparation when every canonical source cleanly reports no listings", () => {
    expect(getAutonomousSourceEligibility(
      [{ platformId: 2 }, { platformId: 5 }, { platformId: 2 }],
      [
        { id: 2, lastScrapeStatus: "success", lastScrapeJobCount: 0, lastScrapeAttemptedAt: now },
        { id: 5, lastScrapeStatus: "success", lastScrapeJobCount: 0, lastScrapeAttemptedAt: now },
      ],
      now
    )).toEqual({
      eligible: false,
      sourcePlatformIds: [2, 5],
      emptySourcePlatformIds: [2, 5],
      staleEmptySourcePlatformIds: [],
      reason: EMPTY_SOURCE_SCAN_REASON,
    });
  });

  it("keeps a cross-posting eligible when any source still returned listings", () => {
    expect(getAutonomousSourceEligibility(
      [{ platformId: 2 }, { platformId: 5 }],
      [
        { id: 2, lastScrapeStatus: "success", lastScrapeJobCount: 0, lastScrapeAttemptedAt: now },
        { id: 5, lastScrapeStatus: "success", lastScrapeJobCount: 7, lastScrapeAttemptedAt: now },
      ],
      now
    )).toMatchObject({
      eligible: true,
      emptySourcePlatformIds: [2],
      staleEmptySourcePlatformIds: [],
      reason: null,
    });
  });

  it("does not let stale or un-timestamped zero-result scans block preparation", () => {
    const stale = new Date(now.getTime() - EMPTY_SOURCE_SCAN_FRESHNESS_MS - 1);

    expect(getAutonomousSourceEligibility(
      [{ platformId: 2 }, { platformId: 5 }],
      [
        { id: 2, lastScrapeStatus: "success", lastScrapeJobCount: 0, lastScrapeAttemptedAt: stale },
        { id: 5, lastScrapeStatus: "success", lastScrapeJobCount: 0 },
      ],
      now
    )).toEqual({
      eligible: true,
      sourcePlatformIds: [2, 5],
      emptySourcePlatformIds: [],
      staleEmptySourcePlatformIds: [2, 5],
      reason: null,
    });
  });

  it("does not treat failed, partial, or unavailable telemetry as a closed listing", () => {
    for (const platform of [
      { id: 2, lastScrapeStatus: "partial" as const, lastScrapeJobCount: 0 },
      { id: 2, lastScrapeStatus: "failed" as const, lastScrapeJobCount: 0 },
      { id: 2, lastScrapeStatus: null, lastScrapeJobCount: null },
    ]) {
      expect(getAutonomousSourceEligibility([{ platformId: 2 }], [platform], now)).toMatchObject({
        eligible: true,
        reason: null,
      });
    }

    expect(getAutonomousSourceEligibility([{ platformId: 2 }], [], now)).toMatchObject({
      eligible: true,
      reason: null,
    });
  });
});
