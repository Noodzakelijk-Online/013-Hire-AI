export interface JobAlertCriteria {
  keywords?: string | string[] | null;
  locations?: string | string[] | null;
  platforms?: string | null;
  platformIds?: number[] | null;
  minSalary?: number | null;
  jobTypes?: string | string[] | null;
}

export interface JobAlertMatchJob {
  title?: string | null;
  company?: string | null;
  description?: string | null;
  requirements?: string | null;
  responsibilities?: string | null;
  benefits?: string | null;
  skills?: string | null;
  location?: string | null;
  platformId?: number | null;
  platformName?: string | null;
  jobType?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
}

function commaSeparatedValues(value?: string | string[] | null) {
  return (Array.isArray(value) ? value : (value || "").split(","))
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function includesEvery(value: string, terms: string[]) {
  return terms.every((term) => value.includes(term));
}

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

/**
 * Matches persisted alert fields against an aggregated job. Keywords are conjunctive;
 * locations, platforms, and job types are alternatives.
 */
export function matchesJobAlert(job: JobAlertMatchJob, criteria: JobAlertCriteria) {
  const keywords = commaSeparatedValues(criteria.keywords);
  const searchableText = [
    job.title,
    job.company,
    job.description,
    job.requirements,
    job.responsibilities,
    job.benefits,
    job.skills,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (keywords.length > 0 && !includesEvery(searchableText, keywords)) return false;

  const locations = commaSeparatedValues(criteria.locations);
  if (locations.length > 0 && !includesAny((job.location || "").toLowerCase(), locations)) return false;

  const platforms = commaSeparatedValues(criteria.platforms);
  const platformIds = criteria.platformIds || [];
  if (platforms.length > 0 || platformIds.length > 0) {
    const platformName = (job.platformName || "").toLowerCase();
    const platformId = job.platformId == null ? "" : String(job.platformId);
    const matchesNamedPlatform = platforms.length === 0 || platforms.some((platform) => platform === platformName || platform === platformId);
    const matchesPlatformId = platformIds.length === 0 || (job.platformId != null && platformIds.includes(job.platformId));
    if (!matchesNamedPlatform || !matchesPlatformId) return false;
  }

  const jobTypes = commaSeparatedValues(criteria.jobTypes);
  if (jobTypes.length > 0 && !jobTypes.includes((job.jobType || "").toLowerCase())) return false;

  if (typeof criteria.minSalary === "number" && criteria.minSalary > 0) {
    const salaryCeiling = job.salaryMax ?? job.salaryMin;
    if (typeof salaryCeiling !== "number" || salaryCeiling < criteria.minSalary) return false;
  }

  return true;
}
