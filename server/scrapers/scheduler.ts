import { getScraperManager } from "./scraperManager";

/**
 * Job Scraping Scheduler
 * Manages automated job scraping on a schedule
 */

export interface SchedulerConfig {
  intervalMinutes: number;
  maxJobsPerRun: number;
  // Undefined preserves an existing runtime configuration; null explicitly enables every source.
  enabledPlatforms?: string[] | null;
}

export interface SchedulerStatus {
  isStarted: boolean;
  isRunning: boolean;
  intervalMinutes: number;
  maxJobsPerRun: number;
  enabledPlatforms: string[] | null;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  totalJobsScraped: number;
  totalRunsCompleted: number;
  errors: string[];
}

export class JobScrapingScheduler {
  private config: SchedulerConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private status: SchedulerStatus = {
    isStarted: false,
    isRunning: false,
    intervalMinutes: 0,
    maxJobsPerRun: 0,
    enabledPlatforms: null,
    lastRunAt: null,
    nextRunAt: null,
    totalJobsScraped: 0,
    totalRunsCompleted: 0,
    errors: [],
  };

  constructor(config: SchedulerConfig) {
    this.config = {
      ...config,
      enabledPlatforms: config.enabledPlatforms?.slice() ?? null,
    };
    this.status.intervalMinutes = this.config.intervalMinutes;
    this.status.maxJobsPerRun = this.config.maxJobsPerRun;
    this.status.enabledPlatforms = this.config.enabledPlatforms?.slice() ?? null;
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.intervalId) {
      console.log("[Scheduler] Already running");
      return;
    }

    this.status.isStarted = true;
    console.log(`[Scheduler] Starting with ${this.config.intervalMinutes} minute interval`);
    
    // Run immediately
    void this.runScraping();

    // Schedule recurring runs
    this.intervalId = setInterval(
      () => void this.runScraping(),
      this.config.intervalMinutes * 60 * 1000
    );

    this.status.nextRunAt = new Date(Date.now() + this.config.intervalMinutes * 60 * 1000);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.status.nextRunAt = null;
      console.log("[Scheduler] Stopped");
    }
    this.status.isStarted = false;
  }

  /**
   * Run a single scraping cycle
   */
  async runScraping(): Promise<void> {
    if (this.status.isRunning) {
      console.log("[Scheduler] Scraping already in progress, skipping");
      return;
    }

    this.status.isRunning = true;
    this.status.errors = [];
    const startTime = Date.now();

    console.log("[Scheduler] Starting scraping run...");

    try {
      const manager = await getScraperManager();
      
      const scrapingOptions: { limit: number; platformNames?: string[] } = {
        limit: this.config.maxJobsPerRun,
      };
      if (this.config.enabledPlatforms?.length) {
        scrapingOptions.platformNames = this.config.enabledPlatforms;
      }
      const result = await manager.runScrapingCycle(scrapingOptions);

      this.status.totalJobsScraped += result.totalSaved;
      this.status.totalRunsCompleted++;
      this.status.lastRunAt = new Date();

      // Collect errors from platform results
      for (const [platform, platformResult] of Object.entries(result.platformResults)) {
        if (platformResult.errors.length > 0) {
          this.status.errors.push(`${platform}: ${platformResult.errors.join(", ")}`);
        }
      }

      const duration = (Date.now() - startTime) / 1000;
      console.log(`[Scheduler] Scraping complete in ${duration.toFixed(1)}s. Saved ${result.totalSaved} jobs.`);

    } catch (error) {
      const errorMsg = `Scraping run failed: ${error}`;
      console.error(`[Scheduler] ${errorMsg}`);
      this.status.errors.push(errorMsg);
    } finally {
      this.status.isRunning = false;
      this.status.nextRunAt = this.intervalId 
        ? new Date(Date.now() + this.config.intervalMinutes * 60 * 1000)
        : null;
    }
  }

  /**
   * Get current scheduler status
   */
  getStatus(): SchedulerStatus {
    return {
      ...this.status,
      enabledPlatforms: this.status.enabledPlatforms?.slice() ?? null,
      errors: [...this.status.errors],
    };
  }

  /**
   * Update scheduler configuration
   */
  updateConfig(config: Partial<SchedulerConfig>): void {
    const shouldRestart = Boolean(
      this.intervalId &&
      config.intervalMinutes !== undefined &&
      config.intervalMinutes !== this.config.intervalMinutes
    );
    this.config = {
      ...this.config,
      ...config,
      enabledPlatforms: config.enabledPlatforms === undefined
        ? this.config.enabledPlatforms
        : config.enabledPlatforms?.slice() ?? null,
    };
    this.status.intervalMinutes = this.config.intervalMinutes;
    this.status.maxJobsPerRun = this.config.maxJobsPerRun;
    this.status.enabledPlatforms = this.config.enabledPlatforms?.slice() ?? null;
    
    // Restart if running with new interval
    if (shouldRestart) {
      this.stop();
      this.start();
    }
  }
}

// Singleton instance
let schedulerInstance: JobScrapingScheduler | null = null;

export function getScheduler(config?: SchedulerConfig): JobScrapingScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new JobScrapingScheduler(config || {
      intervalMinutes: 60, // Default: every hour
      maxJobsPerRun: 100,
    });
  } else if (config) {
    schedulerInstance.updateConfig(config);
  }
  return schedulerInstance;
}

/**
 * Job data normalizer
 * Standardizes job data across different platforms
 */
export class JobNormalizer {
  /**
   * Normalize salary to annual USD
   */
  normalizeSalary(salary: {
    min?: number | null;
    max?: number | null;
    currency?: string | null;
    period?: string | null;
  }): { min: number | null; max: number | null } {
    let { min, max } = salary;
    const currency = salary.currency?.toUpperCase() || "USD";
    const period = salary.period?.toLowerCase() || "yearly";

    // Convert to annual
    if (period === "hourly" || period === "hour") {
      if (min) min = min * 2080; // 40 hours * 52 weeks
      if (max) max = max * 2080;
    } else if (period === "monthly" || period === "month") {
      if (min) min = min * 12;
      if (max) max = max * 12;
    } else if (period === "weekly" || period === "week") {
      if (min) min = min * 52;
      if (max) max = max * 52;
    }

    // Convert to USD (simplified - in production use real exchange rates)
    const exchangeRates: Record<string, number> = {
      USD: 1,
      EUR: 1.1,
      GBP: 1.27,
      CAD: 0.74,
      AUD: 0.65,
      INR: 0.012,
    };

    const rate = exchangeRates[currency] || 1;
    if (min) min = Math.round(min * rate);
    if (max) max = Math.round(max * rate);

    return { min: min || null, max: max || null };
  }

  /**
   * Normalize location string
   */
  normalizeLocation(location: string | null | undefined): string {
    if (!location) return "Remote";
    
    const loc = location.toLowerCase().trim();
    
    if (loc.includes("remote") || loc.includes("anywhere") || loc.includes("worldwide")) {
      return "Remote";
    }
    
    if (loc.includes("usa") || loc.includes("united states")) {
      return "Remote (USA)";
    }
    
    if (loc.includes("europe") || loc.includes("eu")) {
      return "Remote (Europe)";
    }
    
    // Capitalize first letter of each word
    return location
      .split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  /**
   * Normalize job type
   */
  normalizeJobType(type: string | null | undefined): "full-time" | "part-time" | "contract" | "temporary" | null {
    if (!type) return null;
    
    const t = type.toLowerCase();
    
    if (t.includes("full") || t.includes("permanent")) return "full-time";
    if (t.includes("part")) return "part-time";
    if (t.includes("contract") || t.includes("freelance") || t.includes("consultant")) return "contract";
    if (t.includes("temp") || t.includes("intern")) return "temporary";
    
    return null;
  }

  /**
   * Extract skills from job description
   */
  extractSkills(description: string | null | undefined): string[] {
    if (!description) return [];
    
    const commonSkills = [
      "javascript", "typescript", "python", "java", "c++", "c#", "ruby", "go", "rust", "php",
      "react", "vue", "angular", "node.js", "express", "django", "flask", "rails", "spring",
      "aws", "azure", "gcp", "docker", "kubernetes", "terraform", "jenkins", "ci/cd",
      "sql", "mysql", "postgresql", "mongodb", "redis", "elasticsearch",
      "html", "css", "sass", "tailwind", "bootstrap",
      "git", "agile", "scrum", "jira",
      "machine learning", "ai", "data science", "analytics",
      "figma", "sketch", "adobe", "photoshop", "illustrator",
      "marketing", "seo", "content", "copywriting", "social media",
    ];
    
    const descLower = description.toLowerCase();
    const foundSkills: string[] = [];
    
    for (const skill of commonSkills) {
      if (descLower.includes(skill)) {
        foundSkills.push(skill);
      }
    }
    
    return foundSkills;
  }

  /**
   * Clean and normalize description text
   */
  normalizeDescription(description: string | null | undefined): string {
    if (!description) return "";
    
    return description
      .replace(/<[^>]*>/g, " ") // Remove HTML tags
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim()
      .slice(0, 10000); // Limit length
  }
}

export const jobNormalizer = new JobNormalizer();
