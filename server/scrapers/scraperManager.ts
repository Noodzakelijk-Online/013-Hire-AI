import type { BaseScraper, ScrapeResult } from "./baseScraper";
import { getScraperForPlatform, getSupportedPlatforms, hasScraper } from "./index";
import { getDb, updatePlatformLastScraped } from "../db";
import { jobDuplicates, jobs, jobPlatforms } from "../../drizzle/schema";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { samplePlatforms } from "../sampleData";
import { findBestJobDuplicateCandidate } from "../jobDeduplication";

export interface ScrapeOptions {
  keywords?: string;
  location?: string;
  limit?: number;
  platformNames?: string[];
}

function isCurrentListing(job: { isActive?: number | null; expiryDate?: Date | null }, now: Date) {
  return job.isActive === 1 && (!job.expiryDate || job.expiryDate.getTime() > now.getTime());
}

function refreshedListingValues(job: any, current: any, now: Date) {
  return {
    title: job.title ?? current.title,
    company: job.company ?? current.company,
    description: job.description ?? current.description,
    requirements: job.requirements ?? current.requirements,
    responsibilities: job.responsibilities ?? current.responsibilities,
    benefits: job.benefits ?? current.benefits,
    location: job.location ?? current.location,
    jobType: job.jobType ?? current.jobType,
    salaryMin: job.salaryMin ?? current.salaryMin,
    salaryMax: job.salaryMax ?? current.salaryMax,
    salaryCurrency: job.salaryCurrency ?? current.salaryCurrency,
    skills: job.skills ?? current.skills,
    applicationUrl: job.applicationUrl ?? current.applicationUrl,
    applicationEmail: job.applicationEmail ?? current.applicationEmail,
    applicationProcess: job.applicationProcess ?? current.applicationProcess,
    sourceUrl: job.sourceUrl ?? current.sourceUrl,
    postedDate: job.postedDate ?? current.postedDate,
    // Re-observing a source identity supersedes a prior expiry for that source.
    expiryDate: job.expiryDate ?? null,
    isActive: 1,
    visaSponsorshipAvailable: job.visaSponsorshipAvailable ?? current.visaSponsorshipAvailable,
    openHiringSupport: job.openHiringSupport ?? current.openHiringSupport,
    diversityFriendly: job.diversityFriendly ?? current.diversityFriendly,
    updatedAt: now,
  };
}

/**
 * Scraper Manager
 * Coordinates scraping across all platforms and manages job deduplication
 */

export class ScraperManager {
  private scrapers: Map<string, BaseScraper> = new Map();
  private initializationErrors: Map<string, string> = new Map();

  /**
   * Initialize all scrapers
   */
  async initialize(): Promise<void> {
    const db = await getDb();
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
        const message = error instanceof Error ? error.message : String(error);
        this.initializationErrors.set(platform.name, message);
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
   * Registered adapters and configured source records are intentionally separate.
   * A scraper can only be scheduled after an active platform record gives it a
   * durable platform id for job provenance and deduplication.
   */
  getInitializedPlatforms(): string[] {
    return Array.from(this.scrapers.keys()).sort((left, right) => left.localeCompare(right));
  }

  getInitializationError(platformName: string): string | null {
    return this.initializationErrors.get(platformName) ?? null;
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
    if (result.errors.length === 0) {
      await updatePlatformLastScraped(scraper.getPlatformId());
    }
    console.log(
      `[ScraperManager] Scraped ${result.jobs.length} jobs from ${platformName} (${result.errors.length} errors)`
    );

    return result;
  }

  /**
   * Scrape jobs from all platforms
   */
  async scrapeAll(options?: ScrapeOptions): Promise<{
    totalJobs: number;
    platformResults: Record<string, ScrapeResult>;
  }> {
    const platformResults: Record<string, ScrapeResult> = {};
    let totalJobs = 0;

    const requestedPlatformNames = Array.from(new Set(
      options?.platformNames?.map((platformName) => platformName.trim()).filter(Boolean) ?? []
    ));
    const selectedScrapers = requestedPlatformNames.length > 0
      ? Array.from(this.scrapers.entries()).filter(([platformName]) => requestedPlatformNames.includes(platformName))
      : Array.from(this.scrapers.entries());

    console.log(`[ScraperManager] Starting scrape of ${selectedScrapers.length} platforms`);

    for (const platformName of requestedPlatformNames) {
      if (!this.scrapers.has(platformName)) {
        platformResults[platformName] = {
          jobs: [],
          errors: [`No scraper available for platform: ${platformName}`],
          scrapedAt: new Date(),
        };
      }
    }

    for (const [platformName, scraper] of selectedScrapers) {
      try {
        const result = await scraper.scrape(options);
        if (result.errors.length === 0) {
          await updatePlatformLastScraped(scraper.getPlatformId());
        }
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
    refreshed: number;
    duplicates: number;
    errors: number;
  }> {
    const db = await getDb();
    if (!db) {
      return { saved: 0, refreshed: 0, duplicates: scrapedJobs.length, errors: 0 };
    }

    let saved = 0;
    let refreshed = 0;
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
            const current = existing[0];
            await db
              .update(jobs)
              .set(refreshedListingValues(job, current, now))
              .where(eq(jobs.id, current.id));

            const sourceLink = await db
              .select({ primaryJobId: jobDuplicates.primaryJobId })
              .from(jobDuplicates)
              .where(eq(jobDuplicates.duplicateJobId, current.id))
              .limit(1);
            if (sourceLink[0]) {
              const primary = await db
                .select()
                .from(jobs)
                .where(eq(jobs.id, sourceLink[0].primaryJobId))
                .limit(1);
              if (primary[0] && !isCurrentListing(primary[0], now)) {
                // The canonical row represents the aggregate opportunity. A live
                // linked source must keep it discoverable and actionable.
                await db
                  .update(jobs)
                  .set(refreshedListingValues(job, primary[0], now))
                  .where(eq(jobs.id, primary[0].id));
              }
            }
            refreshed++;
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
      `[ScraperManager] Saved ${saved} jobs, refreshed ${refreshed} existing listings, linked ${duplicates} duplicates, ${errors} errors`
    );

    return { saved, refreshed, duplicates, errors };
  }

  /**
   * Run a full scraping cycle
   */
  async runScrapingCycle(options?: ScrapeOptions): Promise<{
    totalScraped: number;
    totalSaved: number;
    totalRefreshed: number;
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
    const { saved, refreshed, duplicates, errors } = await this.saveJobs(allJobs);

    console.log("[ScraperManager] Scraping cycle complete");

    return {
      totalScraped: totalJobs,
      totalSaved: saved,
      totalRefreshed: refreshed,
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
