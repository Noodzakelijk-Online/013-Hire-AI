export interface JobDeduplicationCandidate {
  applicationUrl?: string | null;
  sourceUrl?: string | null;
  title?: string | null;
  company?: string | null;
  description?: string | null;
}

export interface JobDuplicateMatch {
  isDuplicate: boolean;
  similarity: number;
  reason?: "application_url" | "content";
}

const TITLE_NOISE = new Set(["remote", "hybrid", "onsite", "job", "role", "position"]);
const TRACKING_QUERY_PARAMETERS = new Set([
  "source",
  "ref",
  "referrer",
  "referral",
  "gh_src",
  "lever-source",
  "trackingid",
]);

function tokenize(value?: string | null, ignored = new Set<string>()): string[] {
  return (value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 1 && !ignored.has(token));
}

function tokenSimilarity(left?: string | null, right?: string | null, ignored?: Set<string>): number {
  const leftTokens = new Set(tokenize(left, ignored));
  const rightTokens = new Set(tokenize(right, ignored));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  let intersection = 0;
  for (const token of Array.from(leftTokens)) {
    if (rightTokens.has(token)) intersection += 1;
  }
  return intersection / (leftTokens.size + rightTokens.size - intersection);
}

function canonicalizeUrl(value?: string | null): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    const path = url.pathname.replace(/\/+$/, "").toLowerCase();
    for (const key of Array.from(url.searchParams.keys())) {
      if (key.toLowerCase().startsWith("utm_") || TRACKING_QUERY_PARAMETERS.has(key.toLowerCase())) {
        url.searchParams.delete(key);
      }
    }
    url.searchParams.sort();
    return `${url.hostname.replace(/^www\./, "").toLowerCase()}${path}${url.search}`;
  } catch {
    return value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/#.*$/, "")
      .replace(/\/+$/, "");
  }
}

export function compareJobsForDeduplication(
  candidate: JobDeduplicationCandidate,
  existing: JobDeduplicationCandidate
): JobDuplicateMatch {
  const candidateUrls = [candidate.applicationUrl, candidate.sourceUrl]
    .map(canonicalizeUrl)
    .filter((url): url is string => Boolean(url));
  const existingUrls = new Set(
    [existing.applicationUrl, existing.sourceUrl]
      .map(canonicalizeUrl)
      .filter((url): url is string => Boolean(url))
  );

  if (candidateUrls.some((url) => existingUrls.has(url))) {
    return { isDuplicate: true, similarity: 1, reason: "application_url" };
  }

  const companySimilarity = tokenSimilarity(candidate.company, existing.company);
  const titleSimilarity = tokenSimilarity(candidate.title, existing.title, TITLE_NOISE);
  const descriptionSimilarity = tokenSimilarity(candidate.description, existing.description);
  const similarity = (
    companySimilarity * 0.3 +
    titleSimilarity * 0.35 +
    descriptionSimilarity * 0.35
  );

  const isDuplicate = companySimilarity >= 0.8
    && titleSimilarity >= 0.8
    && descriptionSimilarity >= 0.72
    && similarity >= 0.82;

  return {
    isDuplicate,
    similarity,
    reason: isDuplicate ? "content" : undefined,
  };
}
