import type { Job } from "../../drizzle/schema";

/**
 * Base scraper class for job platforms
 * All platform-specific scrapers should extend this class
 */

export interface ScraperConfig {
  platformName: string;
  platformId: number;
  baseUrl: string;
  rateLimit: number; // milliseconds between requests
  maxRetries: number;
}

export interface ScrapeResult {
  jobs: Partial<Job>[];
  errors: string[];
  scrapedAt: Date;
}

export abstract class BaseScraper {
  protected config: ScraperConfig;
  protected lastRequestTime: number = 0;

  constructor(config: ScraperConfig) {
    this.config = config;
  }

  getPlatformId(): number {
    return this.config.platformId;
  }

  /**
   * Main scraping method - must be implemented by each platform scraper
   */
  abstract scrape(options?: {
    keywords?: string;
    location?: string;
    limit?: number;
  }): Promise<ScrapeResult>;

  /**
   * Rate limiting helper
   */
  protected async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.config.rateLimit) {
      const waitTime = this.config.rateLimit - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Retry logic for failed requests
   */
  protected async retry<T>(
    fn: () => Promise<T>,
    retries: number = this.config.maxRetries
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries > 0) {
        console.log(`Retrying... (${retries} attempts left)`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return this.retry(fn, retries - 1);
      }
      throw error;
    }
  }

  /**
   * Normalize job data to match our schema
   */
  protected normalizeJob(rawJob: any): Partial<Job> {
    return {
      platformId: this.config.platformId,
      title: this.cleanText(rawJob.title),
      company: this.cleanText(rawJob.company),
      location: this.cleanText(rawJob.location) || "Remote",
      description: this.cleanText(rawJob.description),
      requirements: this.cleanText(rawJob.requirements),
      responsibilities: this.cleanText(rawJob.responsibilities),
      skills: this.cleanText(rawJob.skills),
      jobType: this.normalizeJobType(rawJob.jobType),
      salaryMin: this.parseSalary(rawJob.salaryMin),
      salaryMax: this.parseSalary(rawJob.salaryMax),
      salaryCurrency: rawJob.salaryCurrency || "USD",
      applicationUrl: this.normalizeApplicationUrl(rawJob.applicationUrl),
      externalId: rawJob.externalId || rawJob.id,
      postedDate: this.parseDate(rawJob.postedDate),
      expiryDate: this.parseDate(rawJob.expiryDate),
      isActive: 1,
    };
  }

  /**
   * Clean and normalize text
   */
  protected cleanText(text: any): string | undefined {
    if (!text) return undefined;
    return String(text)
      .trim()
      .replace(/\s+/g, " ")
      .replace(/\n+/g, "\n");
  }

  /**
   * Normalize job type
   */
  protected normalizeJobType(type: any): "full-time" | "part-time" | "contract" | "temporary" | undefined {
    if (!type) return undefined;

    const typeStr = String(type).toLowerCase();

    if (typeStr.includes("full") || typeStr.includes("fulltime")) return "full-time";
    if (typeStr.includes("part") || typeStr.includes("parttime")) return "part-time";
    if (typeStr.includes("contract")) return "contract";
    if (typeStr.includes("temp")) return "temporary";

    return undefined;
  }

  /**
   * Parse salary string to number
   */
  protected parseSalary(salary: any): number | undefined {
    if (!salary) return undefined;
    if (typeof salary === "number") return salary;

    const str = String(salary).replace(/[^0-9.]/g, "");
    const num = parseFloat(str);

    return isNaN(num) ? undefined : num;
  }

  /** Resolve provider-relative job links and exclude non-web destinations. */
  protected normalizeApplicationUrl(value: unknown): string | undefined {
    if (typeof value !== "string" || !value.trim()) return undefined;

    try {
      const url = new URL(value.trim(), this.config.baseUrl);
      return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Parse date string
   */
  protected parseDate(date: any): Date | undefined {
    if (!date) return undefined;
    if (date instanceof Date) return date;

    try {
      const parsed = new Date(date);
      return isNaN(parsed.getTime()) ? undefined : parsed;
    } catch {
      return undefined;
    }
  }

  /**
   * Log scraping activity
   */
  protected log(message: string, level: "info" | "warn" | "error" = "info"): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${this.config.platformName}] [${level.toUpperCase()}] ${message}`);
  }
}
