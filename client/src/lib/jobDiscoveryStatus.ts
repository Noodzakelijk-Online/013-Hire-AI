export type JobDiscoveryStatus =
  | "no_active_sources"
  | "awaiting_first_scan"
  | "stale"
  | "degraded"
  | "partial"
  | "current";

export interface JobDiscoveryStatusInput {
  activeSources?: number | null;
  sourcesWithSuccessfulScrape?: number | null;
  sourcesWithFreshScrape?: number | null;
  sourcesAwaitingFirstScrape?: number | null;
  sourcesWithStaleScrape?: number | null;
  sourcesWithFailedLatestScrape?: number | null;
  sourcesWithPartialLatestScrape?: number | null;
  sourcesWithEmptyLatestScrape?: number | null;
  sourcesWithFreshFailedLatestScrape?: number | null;
  sourcesWithFreshPartialLatestScrape?: number | null;
  sourcesWithFreshEmptyLatestScrape?: number | null;
  latestSuccessfulScrapeAt?: Date | string | null;
  canonicalJobs?: number | null;
}

export interface JobDiscoveryStatusSummary {
  status: JobDiscoveryStatus;
  label: string;
  detail: string;
  activeSources: number;
  sourcesWithFreshScrape: number;
  sourcesAwaitingFirstScrape: number;
  sourcesWithStaleScrape: number;
  sourcesWithFailedLatestScrape: number;
  sourcesWithPartialLatestScrape: number;
  sourcesWithEmptyLatestScrape: number;
  sourcesWithFreshFailedLatestScrape: number;
  sourcesWithFreshPartialLatestScrape: number;
  sourcesWithFreshEmptyLatestScrape: number;
  canonicalJobs: number;
  latestSuccessfulScrapeAt: Date | null;
}

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

function positiveInteger(value: number | null | undefined) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value as number)) : 0;
}

function parseDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function plural(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function hasFreshOutcomeEvidence(input: JobDiscoveryStatusInput | undefined) {
  return input?.sourcesWithFreshFailedLatestScrape !== undefined
    || input?.sourcesWithFreshPartialLatestScrape !== undefined
    || input?.sourcesWithFreshEmptyLatestScrape !== undefined;
}

export function getJobDiscoveryStatusSummary(
  input: JobDiscoveryStatusInput | undefined,
  now = new Date()
): JobDiscoveryStatusSummary {
  const activeSources = positiveInteger(input?.activeSources);
  const canonicalJobs = positiveInteger(input?.canonicalJobs);
  const sourcesWithSuccessfulScrape = positiveInteger(input?.sourcesWithSuccessfulScrape);
  const sourcesWithFreshScrape = positiveInteger(input?.sourcesWithFreshScrape);
  const sourcesAwaitingFirstScrape = positiveInteger(input?.sourcesAwaitingFirstScrape);
  const sourcesWithStaleScrape = positiveInteger(input?.sourcesWithStaleScrape);
  const sourcesWithFailedLatestScrape = positiveInteger(input?.sourcesWithFailedLatestScrape);
  const sourcesWithPartialLatestScrape = positiveInteger(input?.sourcesWithPartialLatestScrape);
  const sourcesWithEmptyLatestScrape = positiveInteger(input?.sourcesWithEmptyLatestScrape);
  const hasFreshOutcomes = hasFreshOutcomeEvidence(input);
  const sourcesWithFreshFailedLatestScrape = hasFreshOutcomes
    ? positiveInteger(input?.sourcesWithFreshFailedLatestScrape)
    : sourcesWithFailedLatestScrape;
  const sourcesWithFreshPartialLatestScrape = hasFreshOutcomes
    ? positiveInteger(input?.sourcesWithFreshPartialLatestScrape)
    : sourcesWithPartialLatestScrape;
  const sourcesWithFreshEmptyLatestScrape = hasFreshOutcomes
    ? positiveInteger(input?.sourcesWithFreshEmptyLatestScrape)
    : sourcesWithEmptyLatestScrape;
  const latestSuccessfulScrapeAt = parseDate(input?.latestSuccessfulScrapeAt);
  const base = {
    activeSources,
    sourcesWithFreshScrape,
    sourcesAwaitingFirstScrape,
    sourcesWithStaleScrape,
    sourcesWithFailedLatestScrape,
    sourcesWithPartialLatestScrape,
    sourcesWithEmptyLatestScrape,
    sourcesWithFreshFailedLatestScrape,
    sourcesWithFreshPartialLatestScrape,
    sourcesWithFreshEmptyLatestScrape,
    canonicalJobs,
    latestSuccessfulScrapeAt,
  };

  if (activeSources === 0) {
    return {
      ...base,
      status: "no_active_sources",
      label: "Discovery unavailable",
      detail: "No active discovery sources are configured, so the job index cannot be refreshed yet.",
    };
  }

  const degradedSources = sourcesWithFreshFailedLatestScrape
    + sourcesWithFreshPartialLatestScrape
    + sourcesWithFreshEmptyLatestScrape;
  if (degradedSources > 0) {
    const issueDetails = [
      sourcesWithFreshFailedLatestScrape > 0 ? `${plural(sourcesWithFreshFailedLatestScrape, "source")} failed` : "",
      sourcesWithFreshPartialLatestScrape > 0 ? `${plural(sourcesWithFreshPartialLatestScrape, "source")} completed only partially` : "",
      sourcesWithFreshEmptyLatestScrape > 0 ? `${plural(sourcesWithFreshEmptyLatestScrape, "source")} returned no listings` : "",
    ].filter(Boolean);
    return {
      ...base,
      status: "degraded",
      label: "Discovery needs attention",
      detail: `${issueDetails.join(", ")} on a scan in the last 24 hours. Hire.AI will not represent discovery coverage as current until those sources produce a reviewed outcome. ${plural(canonicalJobs, "canonical job")} remain in the index; confirm a listing is still open before preparing materials.`,
    };
  }

  if (sourcesWithSuccessfulScrape === 0 || !latestSuccessfulScrapeAt) {
    return {
      ...base,
      status: "awaiting_first_scan",
      label: "Awaiting verified scan",
      detail: `${plural(activeSources, "source")} ${activeSources === 1 ? "is" : "are"} enabled and the index contains ${plural(canonicalJobs, "canonical job")}, but no successful scan timestamp is recorded. Review posting dates before acting on a listing.`,
    };
  }

  if (sourcesWithFreshScrape === 0 || now.getTime() - latestSuccessfulScrapeAt.getTime() > STALE_AFTER_MS) {
    return {
      ...base,
      status: "stale",
      label: "Discovery may be stale",
      detail: `The last successful scan was more than 24 hours ago. ${plural(canonicalJobs, "canonical job")} remain in the index; confirm a listing is still open before preparing materials.`,
    };
  }

  if (sourcesWithFreshScrape < activeSources) {
    const sourcesNeedingAttention = activeSources - sourcesWithFreshScrape;
    return {
      ...base,
      status: "partial",
      label: "Discovery coverage partial",
      detail: `${plural(sourcesWithFreshScrape, "source")} reported a successful scan in the last 24 hours. ${plural(sourcesNeedingAttention, "source")} ${sourcesNeedingAttention === 1 ? "needs" : "need"} a fresh scan before Hire.AI can represent discovery coverage as complete. ${plural(canonicalJobs, "canonical job")} remain available after deduplication.`,
    };
  }

  return {
    ...base,
    status: "current",
    label: "Discovery current",
    detail: `${plural(sourcesWithFreshScrape, "source")} reported a successful scan in the last 24 hours. ${plural(canonicalJobs, "canonical job")} are available after deduplication.`,
  };
}
