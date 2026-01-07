import { drizzle } from "drizzle-orm/mysql2";
import { jobPlatforms } from "../drizzle/schema.js";
import dotenv from "dotenv";

dotenv.config();

const db = drizzle(process.env.DATABASE_URL);

const platforms = [
  // Tier 1: Major General Remote Job Boards
  { name: "FlexJobs", url: "https://www.flexjobs.com/", tier: "tier1", category: "General" },
  { name: "We Work Remotely", url: "https://weworkremotely.com/", tier: "tier1", category: "General" },
  { name: "Remote.co", url: "https://remote.co/", tier: "tier1", category: "General" },
  { name: "RemoteOK", url: "https://remoteok.com/", tier: "tier1", category: "General" },
  { name: "Indeed", url: "https://www.indeed.com/", tier: "tier1", category: "General" },
  { name: "LinkedIn Jobs", url: "https://www.linkedin.com/jobs/", tier: "tier1", category: "General" },

  // Tier 2: Specialized Remote Job Boards
  { name: "Remotive", url: "https://remotive.io/", tier: "tier2", category: "General" },
  { name: "JustRemote", url: "https://justremote.co/", tier: "tier2", category: "General" },
  { name: "Jobspresso", url: "https://jobspresso.co/", tier: "tier2", category: "General" },
  { name: "Working Nomads", url: "https://workingnomads.com/", tier: "tier2", category: "General" },
  { name: "NoDesk", url: "https://nodesk.co/", tier: "tier2", category: "General" },
  { name: "Remotive.com", url: "https://remotive.com/", tier: "tier2", category: "General" },
  { name: "Pangian", url: "https://pangian.com/", tier: "tier2", category: "Diversity" },
  { name: "Virtual Vocations", url: "https://virtualvocations.com/", tier: "tier2", category: "General" },
  { name: "Skip The Drive", url: "https://www.skipthedrive.com/", tier: "tier2", category: "General" },

  // Tier 3: Industry-Specific Remote Boards
  { name: "Arc", url: "https://arc.dev/", tier: "tier3", category: "Tech" },
  { name: "Gun.io", url: "https://gun.io/", tier: "tier3", category: "Tech" },
  { name: "Stack Overflow Jobs", url: "https://stackoverflow.com/jobs/", tier: "tier3", category: "Tech" },
  { name: "Behance", url: "https://www.behance.net/", tier: "tier3", category: "Design" },
  { name: "Dribbble", url: "https://dribbble.com/", tier: "tier3", category: "Design" },
  { name: "Creativepool", url: "https://creativepool.com/", tier: "tier3", category: "Design" },
  { name: "ProBlogger", url: "https://problogger.com/", tier: "tier3", category: "Writing" },
  { name: "Built In", url: "https://builtin.com/", tier: "tier3", category: "Tech" },
  { name: "Crossover", url: "https://www.crossover.com/", tier: "tier3", category: "Tech" },
  { name: "Wellfound", url: "https://wellfound.com/", tier: "tier3", category: "Startups" },

  // Tier 4: Niche and Emerging Platforms
  { name: "Remote100K", url: "https://remote100k.com/", tier: "tier4", category: "High-Paying" },
  { name: "Jobgether", url: "https://jobgether.com/", tier: "tier4", category: "General" },
  { name: "Remotive.io", url: "https://remotive.io/", tier: "tier4", category: "General" },
  { name: "Contra", url: "https://contra.com/", tier: "tier4", category: "Creative" },
  { name: "Snaphunt", url: "https://snaphunt.com/", tier: "tier4", category: "General" },
  { name: "Remote.com", url: "https://remote.com/", tier: "tier4", category: "General" },
  { name: "HiringCafe", url: "https://hiringcafe.com/", tier: "tier4", category: "General" },
  { name: "DailyRemote", url: "https://dailyremote.com/", tier: "tier4", category: "General" },
  { name: "Outsourcely", url: "https://www.outsourcely.com/", tier: "tier4", category: "Outsourcing" },
  { name: "JobRack", url: "https://jobrack.com/", tier: "tier4", category: "Eastern Europe" },
  { name: "The Muse", url: "https://www.themuse.com/", tier: "tier4", category: "General" },
  { name: "Workster", url: "https://workster.co/", tier: "tier4", category: "General" },
  { name: "Workew", url: "https://workew.com/", tier: "tier4", category: "General" },
  { name: "Remoters", url: "https://remoters.net/", tier: "tier4", category: "General" },
  { name: "Still Hiring Today", url: "https://stillhiring.today/", tier: "tier4", category: "General" },
  { name: "PowerToFly", url: "https://powertofly.com/", tier: "tier4", category: "Diversity" },
  { name: "Dynamite Jobs", url: "https://dynamitejobs.com/", tier: "tier4", category: "General" },
  { name: "Citizen Remote", url: "https://citizenremote.com/", tier: "tier4", category: "General" },
  { name: "EU Remote Jobs", url: "https://euremotejobs.com/", tier: "tier4", category: "Europe" },
  { name: "Inclusively Remote", url: "https://inclusivelyremote.com/", tier: "tier4", category: "Diversity" },
  { name: "Remote Nomad Jobs", url: "https://remotenomadjobs.com/", tier: "tier4", category: "Digital Nomads" },
  { name: "Open To Work Remote", url: "https://opentoworkremote.com/", tier: "tier4", category: "General" },
  { name: "Remote Healthcare Jobs", url: "https://remotehealthcarejobs.com/", tier: "tier4", category: "Healthcare" },
  { name: "SEO Jobs", url: "https://seojobs.com/", tier: "tier4", category: "Marketing" },
  { name: "Dice", url: "https://www.dice.com/", tier: "tier4", category: "Tech" },
];

async function seedPlatforms() {
  try {
    console.log("Seeding job platforms...");
    
    for (const platform of platforms) {
      await db.insert(jobPlatforms).values({
        name: platform.name,
        url: platform.url,
        tier: platform.tier,
        category: platform.category,
        isActive: 1,
      });
      console.log(`✓ Added ${platform.name}`);
    }
    
    console.log(`\n✅ Successfully seeded ${platforms.length} job platforms!`);
  } catch (error) {
    console.error("Error seeding platforms:", error);
    process.exit(1);
  }
  process.exit(0);
}

seedPlatforms();
