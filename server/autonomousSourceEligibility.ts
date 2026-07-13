export type AutonomousSourceObservation = {
  platformId: number | null;
};

export type AutonomousSourceHealth = {
  id: number;
  lastScrapeStatus: "success" | "partial" | "failed" | null;
  lastScrapeJobCount: number | null;
};

export interface AutonomousJobSourceEligibility {
  eligible: boolean;
  sourcePlatformIds: number[];
  emptySourcePlatformIds: number[];
  reason: string | null;
}

export const EMPTY_SOURCE_SCAN_REASON =
  "Every observed source for this job reported no listings in its latest clean scan.";

/**
 * A clean zero-listing scan is strong enough to halt autonomous preparation.
 * Incomplete or failed scans are uncertainty, not evidence that a job closed.
 */
export function getAutonomousSourceEligibility(
  sources: AutonomousSourceObservation[],
  platforms: AutonomousSourceHealth[]
): AutonomousJobSourceEligibility {
  const sourcePlatformIds = Array.from(new Set(
    sources
      .map((source) => source.platformId)
      .filter((platformId): platformId is number => typeof platformId === "number" && Number.isInteger(platformId) && platformId > 0)
  ));
  const platformHealth = new Map(platforms.map((platform) => [platform.id, platform]));
  const emptySourcePlatformIds = sourcePlatformIds.filter((platformId) => {
    const platform = platformHealth.get(platformId);
    return platform?.lastScrapeStatus === "success" && platform.lastScrapeJobCount === 0;
  });
  const everyObservedSourceIsEmpty = sourcePlatformIds.length > 0
    && emptySourcePlatformIds.length === sourcePlatformIds.length;

  return {
    eligible: !everyObservedSourceIsEmpty,
    sourcePlatformIds,
    emptySourcePlatformIds,
    reason: everyObservedSourceIsEmpty ? EMPTY_SOURCE_SCAN_REASON : null,
  };
}
