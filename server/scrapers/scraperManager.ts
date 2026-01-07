import type { BaseScraper, ScrapeResult } from "./baseScraper";
import { getScraperForPlatform, getSupportedPlatforms, hasScraper } from "./index";
import { getDb } from "../db";
import { jobs, jobPlatforms } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Scraper Manager
 * Coordinates scraping across all platforms and manages job deduplication
 */

export class ScraperManager {
  private scrapers: Map<string, BaseScraper> = new Map();

  /**
   * Initialize all scrapers
   */
  async initialize(): Promise<void> {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Get all active platforms
    const platforms = await db
      .select()
      .from(jobPlatforms)
      .where(eq(jobPlatforms.isActive, 1));

    console.log(`[ScraperManager] Initializing scrapers for ${platforms.length} platforms`);

    // Initialize scrapers for platforms we have implemented
    for (const platform of platforms) {
      try {
        const scraper = this.createScraper(platform.name, platform.id);
        if (scraper) {
          this.scrapers.set(platform.name, scraper);
          console.log(`[ScraperManager] Initialized scraper for ${platform.name}`);
        }
      } catch (error) {
        console.error(`[ScraperManager] Failed to initialize scraper for ${platform.name}:`, error);
      }
    }

    console.log(`[ScraperManager] Initialized ${this.scrapers.size} scrapers`);
  }

  /**
   * Create a scraper instance for a platform
   */
  private createScraper(platformName: string, platformId: number): BaseScraper | null {
    return getScraperForPlatform(platformName, platformId);
  }

  /**
   * Get list of supported platforms
   */
  getSupportedPlatforms(): string[] {
    return getSupportedPlatforms();
  }

  /**
   * Check if a platform has a scraper
   */
  hasScraper(platformName: string): boolean {
    return hasScraper(platformName);
  }

  /**
   * Scrape jobs from a specific platform
   */
  async scrapePlatform(
    platformName: string,
    options?: {
      keywords?: string;
      location?: string;
      limit?: number;
    }
  ): Promise<ScrapeResult> {
    const scraper = this.scrapers.get(platformName);

    if (!scraper) {
      return {
        jobs: [],
        errors: [`No scraper available for platform: ${platformName}`],
        scrapedAt: new Date(),
      };
    }

    console.log(`[ScraperManager] Scraping ${platformName}...`);
    const result = await scraper.scrape(options);
    console.log(
      `[ScraperManager] Scraped ${result.jobs.length} jobs from ${platformName} (${result.errors.length} errors)`
    );

    return result;
  }

  /**
   * Scrape jobs from all platforms
   */
  async scrapeAll(options?: {
    keywords?: string;
    location?: string;
    limit?: number;
  }): Promise<{
    totalJobs: number;
    platformResults: Record<string, ScrapeResult>;
  }> {
    const platformResults: Record<string, ScrapeResult> = {};
    let totalJobs = 0;

    console.log(`[ScraperManager] Starting scrape of all ${this.scrapers.size} platforms`);

    for (const [platformName, scraper] of Array.from(this.scrapers.entries())) {
      try {
        const result = await scraper.scrape(options);
        platformResults[platformName] = result;
        totalJobs += result.jobs.length;
      } catch (error) {
        console.error(`[ScraperManager] Failed to scrape ${platformName}:`, error);
        platformResults[platformName] = {
          jobs: [],
          errors: [String(error)],
          scrapedAt: new Date(),
        };
      }
    }

    console.log(`[ScraperManager] Scraping complete. Total jobs: ${totalJobs}`);

    return {
      totalJobs,
      platformResults,
    };
  }

  /**
   * Save scraped jobs to database with deduplication
   */
  async saveJobs(scrapedJobs: any[]): Promise<{
    saved: number;
    duplicates: number;
    errors: number;
  }> {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    let saved = 0;
    let duplicates = 0;
    let errors = 0;

    for (const job of scrapedJobs) {
      try {
        // Check for duplicates by external ID and platform
        if (job.externalId && job.platformId) {
          const existing = await db
            .select()
            .from(jobs)
            .where(eq(jobs.externalId, job.externalId))
            .limit(1);

          if (existing.length > 0) {
            duplicates++;
            continue;
          }
        }

        // Insert new job
        await db.insert(jobs).values(job);
        saved++;
      } catch (error) {
        console.error(`[ScraperManager] Failed to save job:`, error);
        errors++;
      }
    }

    console.log(
      `[ScraperManager] Saved ${saved} jobs, skipped ${duplicates} duplicates, ${errors} errors`
    );

    return { saved, duplicates, errors };
  }

  /**
   * Run a full scraping cycle
   */
  async runScrapingCycle(options?: {
    keywords?: string;
    location?: string;
    limit?: number;
  }): Promise<{
    totalScraped: number;
    totalSaved: number;
    totalDuplicates: number;
    totalErrors: number;
    platformResults: Record<string, ScrapeResult>;
  }> {
    console.log("[ScraperManager] Starting scraping cycle");

    // Scrape all platforms
    const { totalJobs, platformResults } = await this.scrapeAll(options);

    // Collect all jobs
    const allJobs = Object.values(platformResults).flatMap((result) => result.jobs);

    // Save to database
    const { saved, duplicates, errors } = await this.saveJobs(allJobs);

    console.log("[ScraperManager] Scraping cycle complete");

    return {
      totalScraped: totalJobs,
      totalSaved: saved,
      totalDuplicates: duplicates,
      totalErrors: errors,
      platformResults,
    };
  }
}

// Singleton instance
let scraperManagerInstance: ScraperManager | null = null;

export async function getScraperManager(): Promise<ScraperManager> {
  if (!scraperManagerInstance) {
    scraperManagerInstance = new ScraperManager();
    await scraperManagerInstance.initialize();
  }
  return scraperManagerInstance;
}
