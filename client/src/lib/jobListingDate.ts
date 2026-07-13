export type JobListingDateSource = "posted" | "discovered";

export interface JobListingDateInput {
  postedDate?: Date | string | null;
  createdAt?: Date | string | null;
}

export interface JobListingDate {
  date: Date;
  source: JobListingDateSource;
}

function parseDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

/**
 * Source posting dates are preferred. Discovery dates are explicitly labeled
 * as a fallback so the job ledger never presents ingestion time as employer
 * publication time.
 */
export function getJobListingDate(input: JobListingDateInput): JobListingDate | null {
  const postedDate = parseDate(input.postedDate);
  if (postedDate) return { date: postedDate, source: "posted" };

  const discoveredDate = parseDate(input.createdAt);
  return discoveredDate ? { date: discoveredDate, source: "discovered" } : null;
}
