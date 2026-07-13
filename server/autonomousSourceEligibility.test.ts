import { describe, expect, it } from "vitest";
import {
  EMPTY_SOURCE_SCAN_REASON,
  getAutonomousSourceEligibility,
} from "./autonomousSourceEligibility";

describe("autonomous source eligibility", () => {
  it("blocks preparation when every canonical source cleanly reports no listings", () => {
    expect(getAutonomousSourceEligibility(
      [{ platformId: 2 }, { platformId: 5 }, { platformId: 2 }],
      [
        { id: 2, lastScrapeStatus: "success", lastScrapeJobCount: 0 },
        { id: 5, lastScrapeStatus: "success", lastScrapeJobCount: 0 },
      ]
    )).toEqual({
      eligible: false,
      sourcePlatformIds: [2, 5],
      emptySourcePlatformIds: [2, 5],
      reason: EMPTY_SOURCE_SCAN_REASON,
    });
  });

  it("keeps a cross-posting eligible when any source still returned listings", () => {
    expect(getAutonomousSourceEligibility(
      [{ platformId: 2 }, { platformId: 5 }],
      [
        { id: 2, lastScrapeStatus: "success", lastScrapeJobCount: 0 },
        { id: 5, lastScrapeStatus: "success", lastScrapeJobCount: 7 },
      ]
    )).toMatchObject({
      eligible: true,
      emptySourcePlatformIds: [2],
      reason: null,
    });
  });

  it("does not treat failed, partial, or unavailable telemetry as a closed listing", () => {
    for (const platform of [
      { id: 2, lastScrapeStatus: "partial" as const, lastScrapeJobCount: 0 },
      { id: 2, lastScrapeStatus: "failed" as const, lastScrapeJobCount: 0 },
      { id: 2, lastScrapeStatus: null, lastScrapeJobCount: null },
    ]) {
      expect(getAutonomousSourceEligibility([{ platformId: 2 }], [platform])).toMatchObject({
        eligible: true,
        reason: null,
      });
    }

    expect(getAutonomousSourceEligibility([{ platformId: 2 }], [])).toMatchObject({
      eligible: true,
      reason: null,
    });
  });
});
