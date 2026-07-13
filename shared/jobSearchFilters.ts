import { normalizeSalaryCurrency } from "./salaryCurrency";

export type JobExperienceLevel = "all" | "entry" | "junior" | "mid" | "senior" | "lead" | "executive";
export type JobApplicationProcessFilter = "all" | "greenhouse" | "lever" | "workday" | "email" | "other";
export type JobPostedWithin = "all" | "1" | "3" | "7" | "30";
export type JobTypeFilter = "all" | "full-time" | "part-time" | "contract" | "temporary";

export interface JobSearchFilterState {
  query: string;
  jobType: JobTypeFilter;
  platformId: string;
  salaryRange: [number, number];
  salaryCurrency: string;
  remoteOnly: boolean;
  experienceLevel: JobExperienceLevel;
  applicationProcess: JobApplicationProcessFilter;
  visaSponsorshipOnly: boolean;
  openHiringSupportOnly: boolean;
  diversityFriendlyOnly: boolean;
  salaryDisclosedOnly: boolean;
  postedWithin: JobPostedWithin;
}

export interface JobSearchFilterJob {
  title?: string | null;
  company?: string | null;
  description?: string | null;
  requirements?: string | null;
  responsibilities?: string | null;
  benefits?: string | null;
  skills?: string | null;
  location?: string | null;
  jobType?: string | null;
  platformId?: number | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  applicationProcess?: string | null;
  visaSponsorshipAvailable?: number | boolean | null;
  openHiringSupport?: number | boolean | null;
  diversityFriendly?: number | boolean | null;
  postedDate?: Date | string | null;
  createdAt?: Date | string | null;
}

export const defaultJobSearchFilters: JobSearchFilterState = {
  query: "",
  jobType: "all",
  platformId: "all",
  salaryRange: [0, 300000],
  salaryCurrency: "all",
  remoteOnly: true,
  experienceLevel: "all",
  applicationProcess: "all",
  visaSponsorshipOnly: false,
  openHiringSupportOnly: false,
  diversityFriendlyOnly: false,
  salaryDisclosedOnly: false,
  postedWithin: "all",
};

function text(job: JobSearchFilterJob) {
  return [job.title, job.company, job.description, job.requirements, job.responsibilities, job.benefits, job.skills]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function hasRemoteSignal(value?: string | null) {
  return /\b(remote|worldwide|anywhere|distributed|work from home|wfh)\b/i.test(value || "");
}

function hasNonRemoteSignal(value?: string | null) {
  return /\b(hybrid|onsite|on-site|in office|in-office)\b/i.test(value || "");
}

function isRemote(job: JobSearchFilterJob) {
  const listingText = [
    job.location,
    job.title,
    job.description,
    job.requirements,
    job.responsibilities,
  ].filter(Boolean).join(" ");

  // A hybrid or office-bound statement is stronger than a generic "remote"
  // mention elsewhere in the listing when the user asks for remote-only work.
  if (hasNonRemoteSignal(listingText)) return false;
  if (hasRemoteSignal(job.location)) return true;

  // Some sources retain a geographic location while placing the remote
  // eligibility in the role title or posting body.
  return hasRemoteSignal(listingText);
}

function experienceLevel(job: JobSearchFilterJob): Exclude<JobExperienceLevel, "all"> | "unknown" {
  const value = `${job.title || ""} ${job.requirements || ""}`.toLowerCase();
  if (/\b(intern|internship|graduate|entry[ -]?level|new grad)\b/.test(value)) return "entry";
  if (/\b(junior|jr\.?|1\+? years?|2\+? years?)\b/.test(value)) return "junior";
  if (/\b(mid[ -]?level|intermediate|3\+? years?|4\+? years?)\b/.test(value)) return "mid";
  if (/\b(senior|sr\.?|5\+? years?|6\+? years?)\b/.test(value)) return "senior";
  if (/\b(lead|principal|staff|architect|7\+? years?|8\+? years?)\b/.test(value)) return "lead";
  if (/\b(executive|director|vice president|\bvp\b|chief|c-suite)\b/.test(value)) return "executive";
  return "unknown";
}

function hasFlag(value: number | boolean | null | undefined) {
  return value === true || value === 1;
}

function hasSalaryOverlap(job: JobSearchFilterJob, range: [number, number]) {
  const hasSalary = typeof job.salaryMin === "number" || typeof job.salaryMax === "number";
  if (!hasSalary) return null;
  const jobMin = job.salaryMin ?? Number.NEGATIVE_INFINITY;
  const jobMax = job.salaryMax ?? Number.POSITIVE_INFINITY;
  return jobMin <= range[1] && jobMax >= range[0];
}

function isWithinPostedWindow(job: JobSearchFilterJob, postedWithin: JobPostedWithin, now: Date) {
  if (postedWithin === "all") return true;
  const dateValue = job.postedDate || job.createdAt;
  const postedAt = dateValue ? new Date(dateValue).getTime() : Number.NaN;
  return Number.isFinite(postedAt) && postedAt >= now.getTime() - Number(postedWithin) * 86400000;
}

export function filterJobListings<T extends JobSearchFilterJob>(jobs: T[], filters: JobSearchFilterState, now = new Date()) {
  const queryTerms = filters.query.toLowerCase().trim().split(/\s+/).filter(Boolean);

  return jobs.filter((job) => {
    if (queryTerms.length > 0 && !queryTerms.every((term) => text(job).includes(term))) return false;
    if (filters.jobType !== "all" && job.jobType !== filters.jobType) return false;
    if (filters.platformId !== "all" && String(job.platformId) !== filters.platformId) return false;
    if (filters.remoteOnly && !isRemote(job)) return false;
    if (filters.experienceLevel !== "all" && experienceLevel(job) !== filters.experienceLevel) return false;
    if (filters.visaSponsorshipOnly && !hasFlag(job.visaSponsorshipAvailable)) return false;
    if (filters.openHiringSupportOnly && !hasFlag(job.openHiringSupport)) return false;
    if (filters.diversityFriendlyOnly && !hasFlag(job.diversityFriendly)) return false;
    if (!isWithinPostedWindow(job, filters.postedWithin, now)) return false;

    const process = (job.applicationProcess || "").toLowerCase();
    if (filters.applicationProcess !== "all") {
      const processMatches = filters.applicationProcess === "other"
        ? !["greenhouse", "lever", "workday", "email"].includes(process)
        : process === filters.applicationProcess;
      if (!processMatches) return false;
    }

    const shouldCompareSalary = filters.salaryCurrency !== "all";
    const salaryCurrencyMatches = !shouldCompareSalary ||
      normalizeSalaryCurrency(job.salaryCurrency) === normalizeSalaryCurrency(filters.salaryCurrency);
    if (!salaryCurrencyMatches) return false;

    const salaryOverlap = shouldCompareSalary ? hasSalaryOverlap(job, filters.salaryRange) : null;
    const hasSalary = typeof job.salaryMin === "number" || typeof job.salaryMax === "number";
    if (filters.salaryDisclosedOnly && !hasSalary) return false;
    return salaryOverlap !== false || !shouldCompareSalary;
  });
}

export function countActiveJobSearchFilters(filters: JobSearchFilterState) {
  return [
    filters.query.trim().length > 0,
    filters.jobType !== "all",
    filters.platformId !== "all",
    filters.salaryCurrency !== "all",
    filters.salaryRange[0] !== defaultJobSearchFilters.salaryRange[0] || filters.salaryRange[1] !== defaultJobSearchFilters.salaryRange[1],
    filters.remoteOnly !== defaultJobSearchFilters.remoteOnly,
    filters.experienceLevel !== "all",
    filters.applicationProcess !== "all",
    filters.visaSponsorshipOnly,
    filters.openHiringSupportOnly,
    filters.diversityFriendlyOnly,
    filters.salaryDisclosedOnly,
    filters.postedWithin !== "all",
  ].filter(Boolean).length;
}
