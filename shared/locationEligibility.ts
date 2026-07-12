export type LocationPreferenceFit = "fit" | "partial" | "gap" | "unknown";

const COUNTRY_REGIONS: Array<[string, string, string[]]> = [
  ["United States", "North America", ["united states", "usa", "us"]],
  ["Canada", "North America", ["canada", "ca"]],
  ["Mexico", "North America", ["mexico", "mx"]],
  ["United Kingdom", "Europe", ["united kingdom", "uk", "great britain", "england"]],
  ["Netherlands", "Europe", ["netherlands", "holland", "nl"]],
  ["Germany", "Europe", ["germany", "deutschland", "de"]],
  ["France", "Europe", ["france", "fr"]],
  ["Ireland", "Europe", ["ireland", "ie"]],
  ["Spain", "Europe", ["spain", "es"]],
  ["Portugal", "Europe", ["portugal", "pt"]],
  ["Poland", "Europe", ["poland", "pl"]],
  ["Sweden", "Europe", ["sweden", "se"]],
  ["Norway", "Europe", ["norway", "no"]],
  ["Denmark", "Europe", ["denmark", "dk"]],
  ["Finland", "Europe", ["finland", "fi"]],
  ["Switzerland", "Europe", ["switzerland", "ch"]],
  ["Austria", "Europe", ["austria", "at"]],
  ["Belgium", "Europe", ["belgium", "be"]],
  ["Australia", "Oceania", ["australia", "au"]],
  ["New Zealand", "Oceania", ["new zealand", "nz"]],
  ["India", "Asia", ["india", "in"]],
  ["Singapore", "Asia", ["singapore", "sg"]],
  ["Japan", "Asia", ["japan", "jp"]],
  ["Brazil", "South America", ["brazil", "br"]],
  ["Argentina", "South America", ["argentina", "ar"]],
];

const GLOBAL_TERMS = new Set(["worldwide", "anywhere", "global"]);
const REMOTE_TERMS = new Set(["remote", "distributed", "work from home", "wfh"]);

function canonical(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function splitPreferences(value?: string | null) {
  return (value || "").split(/[,;\n]/).map(canonical).filter(Boolean);
}

function containsPhrase(text: string, phrase: string) {
  return ` ${text} `.includes(` ${phrase} `);
}

function locationTerms(location: string) {
  const terms = new Set<string>([location]);
  for (const [country, region, aliases] of COUNTRY_REGIONS) {
    if (aliases.some((alias) => containsPhrase(location, canonical(alias)))) {
      terms.add(canonical(country));
      terms.add(canonical(region));
    }
  }
  for (const region of ["north america", "south america", "europe", "asia", "oceania"]) {
    if (containsPhrase(location, region)) terms.add(region);
  }
  return terms;
}

function expandDesiredTerms(desiredLocations: string[]) {
  const terms = new Set(desiredLocations);
  for (const desired of desiredLocations) {
    for (const [country, region, aliases] of COUNTRY_REGIONS) {
      if (aliases.some((alias) => desired === canonical(alias))) {
        terms.add(canonical(country));
        terms.add(canonical(region));
      }
    }
  }
  return terms;
}

function hasTerm(location: string, terms: Set<string>) {
  return Array.from(terms).some((term) => containsPhrase(location, term));
}

/**
 * Generic remote listings stay reviewable when jurisdiction is unknown. Remote
 * listings with an explicit incompatible geography are a hard mismatch.
 */
export function getLocationPreferenceFit(
  locationValue?: string | null,
  desiredLocationsValue?: string | null
): LocationPreferenceFit {
  const location = canonical(locationValue || "");
  const desiredLocations = splitPreferences(desiredLocationsValue);
  if (!location && desiredLocations.length === 0) return "unknown";
  if (desiredLocations.length === 0) return location ? "partial" : "unknown";

  const remote = hasTerm(location, REMOTE_TERMS);
  const global = hasTerm(location, GLOBAL_TERMS);
  const terms = locationTerms(location);
  const desiredTerms = expandDesiredTerms(desiredLocations);
  const desiredRemote = desiredLocations.some((value) => REMOTE_TERMS.has(value));
  const desiredGlobal = desiredLocations.some((value) => GLOBAL_TERMS.has(value));

  if (global && remote) return "fit";
  if (remote && (desiredRemote || desiredGlobal)) return "fit";
  if (Array.from(desiredTerms).some((desired) => Array.from(terms).some((term) =>
    term === desired || containsPhrase(term, desired) || containsPhrase(desired, term)
  ))) {
    return "fit";
  }

  if (remote && terms.size === 1) return "partial";
  return "gap";
}
