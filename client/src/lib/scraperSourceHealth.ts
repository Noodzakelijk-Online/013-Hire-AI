export type ScraperSourceOutcome = "success" | "empty" | "partial" | "failed" | "awaiting";

export interface ScraperSourceHealthInput {
  lastScrapeStatus?: "success" | "partial" | "failed" | null;
  lastScrapeJobCount?: number | null;
  lastScrapeError?: string | null;
}

export interface ScraperSourceHealthSummary {
  outcome: ScraperSourceOutcome;
  label: string;
  tone: string;
  jobCount: number | null;
  error: string | null;
}

export interface ScraperSourceOutcomeCounts {
  success: number;
  empty: number;
  partial: number;
  failed: number;
  awaiting: number;
  issues: number;
}

function nonNegativeInteger(value: number | null | undefined) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value as number)) : null;
}

/**
 * The scraper ledger stores source-run evidence separately from the last
 * successful timestamp. This keeps the admin view from treating legacy or
 * failed state as proof that a source is healthy.
 */
export function getScraperSourceHealthSummary(
  source: ScraperSourceHealthInput
): ScraperSourceHealthSummary {
  const jobCount = nonNegativeInteger(source.lastScrapeJobCount);
  const error = source.lastScrapeError?.trim() || null;

  switch (source.lastScrapeStatus) {
    case "success":
      if (jobCount === 0) {
        return {
          outcome: "empty",
          label: "No listings observed",
          tone: "border-amber-500/30 text-amber-300",
          jobCount,
          error: null,
        };
      }
      return {
        outcome: "success",
        label: "Succeeded",
        tone: "border-emerald-500/30 text-emerald-300",
        jobCount,
        error: null,
      };
    case "partial":
      return {
        outcome: "partial",
        label: "Partial",
        tone: "border-amber-500/30 text-amber-300",
        jobCount,
        error,
      };
    case "failed":
      return {
        outcome: "failed",
        label: "Failed",
        tone: "border-red-500/30 text-red-300",
        jobCount,
        error,
      };
    default:
      return {
        outcome: "awaiting",
        label: "Awaiting scan",
        tone: "border-slate-600 text-slate-400",
        jobCount: null,
        error: null,
      };
  }
}

export function getScraperSourceOutcomeCounts(
  sources: ScraperSourceHealthInput[] | null | undefined
): ScraperSourceOutcomeCounts {
  const counts: ScraperSourceOutcomeCounts = {
    success: 0,
    empty: 0,
    partial: 0,
    failed: 0,
    awaiting: 0,
    issues: 0,
  };

  for (const source of sources || []) {
    const outcome = getScraperSourceHealthSummary(source).outcome;
    counts[outcome] += 1;
  }
  counts.issues = counts.empty + counts.partial + counts.failed;
  return counts;
}
