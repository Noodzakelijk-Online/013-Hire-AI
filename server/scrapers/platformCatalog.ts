export type ScraperPlatformSeed = {
  name: string;
  url: string;
  tier: "tier1" | "tier2" | "tier3" | "tier4";
  category: string;
};

/**
 * Persistent source metadata for every adapter in the scraper registry.
 * Adding this catalog never starts a scrape; it only gives supported adapters
 * a durable platform identity for provenance, scheduling, and deduplication.
 */
export const scraperPlatformCatalog = [
  { name: "RemoteOK", url: "https://remoteok.com/", tier: "tier1", category: "General" },
  { name: "We Work Remotely", url: "https://weworkremotely.com/", tier: "tier1", category: "General" },
  { name: "FlexJobs", url: "https://www.flexjobs.com/", tier: "tier1", category: "General" },
  { name: "Indeed", url: "https://www.indeed.com/", tier: "tier1", category: "General" },
  { name: "LinkedIn Jobs", url: "https://www.linkedin.com/jobs/", tier: "tier1", category: "General" },
  { name: "Remote.co", url: "https://remote.co/", tier: "tier1", category: "General" },
  { name: "Remotive", url: "https://remotive.com/", tier: "tier2", category: "General" },
  { name: "JustRemote", url: "https://justremote.co/", tier: "tier2", category: "General" },
  { name: "Jobspresso", url: "https://jobspresso.co/", tier: "tier2", category: "General" },
  { name: "Working Nomads", url: "https://www.workingnomads.com/jobs", tier: "tier2", category: "General" },
  { name: "NoDesk", url: "https://nodesk.co/", tier: "tier2", category: "General" },
  { name: "Pangian", url: "https://pangian.com/", tier: "tier2", category: "General" },
  { name: "Virtual Vocations", url: "https://www.virtualvocations.com/", tier: "tier2", category: "General" },
  { name: "Skip The Drive", url: "https://www.skipthedrive.com/", tier: "tier2", category: "General" },
  { name: "Arc", url: "https://arc.dev/", tier: "tier3", category: "Tech" },
  { name: "Gun.io", url: "https://gun.io/", tier: "tier3", category: "Tech" },
  { name: "Stack Overflow Jobs", url: "https://stackoverflow.com/jobs", tier: "tier3", category: "Tech" },
  { name: "Behance", url: "https://www.behance.net/joblist", tier: "tier3", category: "Creative" },
  { name: "Dribbble", url: "https://dribbble.com/jobs", tier: "tier3", category: "Creative" },
  { name: "Creativepool", url: "https://creativepool.com/jobs", tier: "tier3", category: "Creative" },
  { name: "ProBlogger", url: "https://problogger.com/jobs", tier: "tier3", category: "Writing" },
  { name: "Built In", url: "https://builtin.com/jobs/remote", tier: "tier3", category: "Tech" },
  { name: "Crossover", url: "https://www.crossover.com/jobs", tier: "tier3", category: "Tech" },
  { name: "Wellfound", url: "https://wellfound.com/jobs", tier: "tier3", category: "Startup" },
  { name: "Remote100K", url: "https://remote100k.com/", tier: "tier4", category: "General" },
  { name: "Jobgether", url: "https://jobgether.com/", tier: "tier4", category: "General" },
  { name: "Contra", url: "https://contra.com/jobs", tier: "tier4", category: "Contract" },
  { name: "Snaphunt", url: "https://snaphunt.com/job-listing", tier: "tier4", category: "General" },
  { name: "Remote.com", url: "https://remote.com/jobs", tier: "tier4", category: "General" },
  { name: "HiringCafe", url: "https://hiring.cafe/", tier: "tier4", category: "General" },
  { name: "DailyRemote", url: "https://dailyremote.com/", tier: "tier4", category: "General" },
  { name: "Outsourcely", url: "https://www.outsourcely.com/remote-jobs", tier: "tier4", category: "Contract" },
  { name: "JobRack", url: "https://jobrack.eu/", tier: "tier4", category: "General" },
  { name: "The Muse", url: "https://www.themuse.com/jobs", tier: "tier4", category: "General" },
  { name: "Workster", url: "https://workster.com/", tier: "tier4", category: "General" },
  { name: "Workew", url: "https://workew.com/", tier: "tier4", category: "General" },
  { name: "Remoters", url: "https://remoters.net/jobs", tier: "tier4", category: "General" },
  { name: "Still Hiring Today", url: "https://stillhiring.today/", tier: "tier4", category: "General" },
  { name: "PowerToFly", url: "https://powertofly.com/jobs", tier: "tier4", category: "Diversity" },
  { name: "Dynamite Jobs", url: "https://dynamitejobs.com/", tier: "tier4", category: "General" },
  { name: "Citizen Remote", url: "https://citizenremote.com/", tier: "tier4", category: "General" },
  { name: "EU Remote Jobs", url: "https://euremotejobs.com/", tier: "tier4", category: "Regional" },
  { name: "Inclusively Remote", url: "https://inclusively.com/jobs", tier: "tier4", category: "Diversity" },
  { name: "Remote Nomad Jobs", url: "https://remotenomadjobs.com/", tier: "tier4", category: "General" },
  { name: "Open To Work Remote", url: "https://opentoworkremote.com/", tier: "tier4", category: "General" },
  { name: "Remote Healthcare Jobs", url: "https://remotehealthcarejobs.com/", tier: "tier4", category: "Healthcare" },
  { name: "SEO Jobs", url: "https://seojobs.com/", tier: "tier4", category: "Marketing" },
  { name: "Dice", url: "https://www.dice.com/jobs", tier: "tier4", category: "Tech" },
] satisfies readonly ScraperPlatformSeed[];

export function getMissingScraperPlatformCatalog(configuredNames: Iterable<string>) {
  const configured = new Set(configuredNames);
  return scraperPlatformCatalog.filter((platform) => !configured.has(platform.name));
}
