export interface JobAlertCriteria {
  keywords?: string | null;
  locations?: string | null;
  platforms?: string | null;
  minSalary?: number | null;
  jobTypes?: string | null;
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

function commaSeparatedValues(value?: string | null) {
  return (value || "")
    .split(",")
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
  if (platforms.length > 0) {
    const platformName = (job.platformName || "").toLowerCase();
    const platformId = job.platformId == null ? "" : String(job.platformId);
    if (!platforms.some((platform) => platform === platformName || platform === platformId)) return false;
  }

  const jobTypes = commaSeparatedValues(criteria.jobTypes);
  if (jobTypes.length > 0 && !jobTypes.includes((job.jobType || "").toLowerCase())) return false;

  if (typeof criteria.minSalary === "number" && criteria.minSalary > 0) {
    const salaryCeiling = job.salaryMax ?? job.salaryMin;
    if (typeof salaryCeiling !== "number" || salaryCeiling < criteria.minSalary) return false;
  }

  return true;
}
