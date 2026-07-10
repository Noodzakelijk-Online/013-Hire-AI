import type { BaseScraper, ScrapeResult } from "./baseScraper";
import { getScraperForPlatform, getSupportedPlatforms, hasScraper } from "./index";
import { getDb } from "../db";
import { jobDuplicates, jobs, jobPlatforms } from "../../drizzle/schema";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { samplePlatforms } from "../sampleData";
import { findBestJobDuplicateCandidate } from "../jobDeduplication";

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
    const supportedPlatformNames = getSupportedPlatforms();
    const platforms = db
      ? await db.select().from(jobPlatforms).where(eq(jobPlatforms.isActive, 1))
      : samplePlatforms.filter((platform) => platform.isActive === 1);

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

    if (this.scrapers.size === 0) {
      supportedPlatformNames.forEach((platformName, index) => {
        const scraper = this.createScraper(platformName, index + 1);
        if (scraper) {
          this.scrapers.set(platformName, scraper);
        }
      });
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
      return { saved: 0, duplicates: scrapedJobs.length, errors: 0 };
    }

    let saved = 0;
    let duplicates = 0;
    let errors = 0;
    const now = new Date();

    for (const job of scrapedJobs) {
      try {
        // Check for duplicates by external ID and platform
        if (job.externalId && job.platformId) {
          const existing = await db
            .select()
            .from(jobs)
            .where(and(eq(jobs.externalId, job.externalId), eq(jobs.platformId, job.platformId)))
            .limit(1);

          if (existing.length > 0) {
            duplicates++;
            continue;
          }
        }

        const duplicateCandidates = job.company && job.title
          ? await db
              .select({
                id: jobs.id,
                applicationUrl: jobs.applicationUrl,
                sourceUrl: jobs.sourceUrl,
                title: jobs.title,
                company: jobs.company,
                description: jobs.description,
              })
              .from(jobs)
              .where(and(
                or(
                  eq(jobs.company, job.company),
                  eq(jobs.title, job.title)
                ),
                eq(jobs.isActive, 1),
                or(isNull(jobs.expiryDate), gt(jobs.expiryDate, now)),
                sql`NOT EXISTS (
                  SELECT 1 FROM ${jobDuplicates}
                  WHERE ${jobDuplicates.duplicateJobId} = ${jobs.id}
                )`
              ))
              .limit(100)
          : [];
        const crossPlatformDuplicate = findBestJobDuplicateCandidate(job, duplicateCandidates);
        if (crossPlatformDuplicate) {
          const duplicateWrite = await db.insert(jobs).values(job);
          const duplicateJobId = Number(duplicateWrite[0].insertId);
          await db.insert(jobDuplicates).values({
            primaryJobId: crossPlatformDuplicate.job.id,
            duplicateJobId,
            similarityScore: Math.round(crossPlatformDuplicate.match.similarity * 100),
          });
          duplicates++;
          continue;
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
