export type AutonomousSourceObservation = {
  platformId: number | null;
};

export type AutonomousSourceHealth = {
  id: number;
  lastScrapeStatus: "success" | "partial" | "failed" | null;
  lastScrapeJobCount: number | null;
  lastScraped?: Date | string | null;
  lastScrapeAttemptedAt?: Date | string | null;
};

export interface AutonomousJobSourceEligibility {
  eligible: boolean;
  sourcePlatformIds: number[];
  emptySourcePlatformIds: number[];
  staleEmptySourcePlatformIds: number[];
  reason: string | null;
}

export const EMPTY_SOURCE_SCAN_REASON =
  "Every observed source for this job reported no listings in its latest clean scan.";
export const EMPTY_SOURCE_SCAN_FRESHNESS_MS = 24 * 60 * 60 * 1000;

function isFreshScanTimestamp(
  value: Date | string | null | undefined,
  now: Date
): boolean {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp <= now.getTime() && now.getTime() - timestamp <= EMPTY_SOURCE_SCAN_FRESHNESS_MS;
}

/**
 * A clean zero-listing scan is strong enough to halt autonomous preparation.
 * Incomplete or failed scans are uncertainty, not evidence that a job closed.
 */
export function getAutonomousSourceEligibility(
  sources: AutonomousSourceObservation[],
  platforms: AutonomousSourceHealth[],
  now = new Date()
): AutonomousJobSourceEligibility {
  const sourcePlatformIds = Array.from(new Set(
    sources
      .map((source) => source.platformId)
      .filter((platformId): platformId is number => typeof platformId === "number" && Number.isInteger(platformId) && platformId > 0)
  ));
  const platformHealth = new Map(platforms.map((platform) => [platform.id, platform]));
  const cleanZeroSourcePlatformIds = sourcePlatformIds.filter((platformId) => {
    const platform = platformHealth.get(platformId);
    return platform?.lastScrapeStatus === "success" && platform.lastScrapeJobCount === 0;
  });
  const emptySourcePlatformIds = cleanZeroSourcePlatformIds.filter((platformId) => {
    const platform = platformHealth.get(platformId);
    return isFreshScanTimestamp(platform?.lastScrapeAttemptedAt ?? platform?.lastScraped, now);
  });
  const staleEmptySourcePlatformIds = cleanZeroSourcePlatformIds.filter((platformId) =>
    !emptySourcePlatformIds.includes(platformId)
  );
  const everyObservedSourceIsEmpty = sourcePlatformIds.length > 0
    && emptySourcePlatformIds.length === sourcePlatformIds.length;

  return {
    eligible: !everyObservedSourceIsEmpty,
    sourcePlatformIds,
    emptySourcePlatformIds,
    staleEmptySourcePlatformIds,
    reason: everyObservedSourceIsEmpty ? EMPTY_SOURCE_SCAN_REASON : null,
  };
}
