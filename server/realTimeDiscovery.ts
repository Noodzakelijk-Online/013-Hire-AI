/**
 * Real-Time Job Discovery Service
 * Provides polling-based notifications for new jobs
 */

import { getDb } from "./db";
import { jobs } from "../drizzle/schema";
import { asc, desc, gt, and, eq, gte, inArray, like, or, sql } from "drizzle-orm";
import { sampleJobs } from "./sampleData";

// ============================================================================
// TYPES
// ============================================================================

export interface JobDiscoveryEvent {
  type: "new_job" | "job_updated" | "job_removed" | "batch_complete";
  timestamp: Date;
  data: {
    jobId?: number;
    jobs?: JobSummary[];
    platformId?: number;
    count?: number;
  };
}

export interface JobSummary {
  id: number;
  title: string;
  company: string;
  location: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  platformId: number;
  postedDate: Date | null;
  matchScore?: number;
}

export interface DiscoverySubscription {
  userId: number;
  filters: {
    keywords?: string[];
    locations?: string[];
    minSalary?: number;
    jobTypes?: string[];
    platformIds?: number[];
    experienceLevels?: string[];
  };
  callback: (event: JobDiscoveryEvent) => void;
}

// ============================================================================
// IN-MEMORY SUBSCRIPTION MANAGER
// ============================================================================

class SubscriptionManager {
  private subscriptions: Map<number, DiscoverySubscription> = new Map();
  private lastCheckedTimestamp: Date = new Date();
  private lastCheckedId = 0;
  private pollingInterval: NodeJS.Timeout | null = null;
  private isPolling = false;

  /**
   * Subscribe a user to job discovery events
   */
  subscribe(subscription: DiscoverySubscription): void {
    this.subscriptions.set(subscription.userId, subscription);
    console.log(`[Discovery] User ${subscription.userId} subscribed to job updates`);
    
    if (!this.isPolling) {
      this.startPolling();
    }
  }

  /**
   * Unsubscribe a user from job discovery events
   */
  unsubscribe(userId: number): void {
    this.subscriptions.delete(userId);
    console.log(`[Discovery] User ${userId} unsubscribed from job updates`);
    
    if (this.subscriptions.size === 0) {
      this.stopPolling();
    }
  }

  /**
   * Get all active subscriptions
   */
  getSubscriptions(): DiscoverySubscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Start polling for new jobs
   */
  private startPolling(): void {
    if (this.pollingInterval) return;
    
    this.isPolling = true;
    this.pollingInterval = setInterval(() => {
      this.checkForNewJobs();
    }, 30000);
    
    console.log("[Discovery] Started polling for new jobs");
  }

  /**
   * Stop polling for new jobs
   */
  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling = false;
    console.log("[Discovery] Stopped polling for new jobs");
  }

  /**
   * Check for new jobs since last check
   */
  private async checkForNewJobs(): Promise<void> {
    try {
      const db = await getDb();
      if (!db) return;

      const newJobs = await db
        .select({
          id: jobs.id,
          title: jobs.title,
          company: jobs.company,
          location: jobs.location,
          salaryMin: jobs.salaryMin,
          salaryMax: jobs.salaryMax,
          platformId: jobs.platformId,
          postedDate: jobs.postedDate,
          createdAt: jobs.createdAt,
        })
        .from(jobs)
        .where(
          and(
            or(
              gt(jobs.createdAt, this.lastCheckedTimestamp),
              and(
                eq(jobs.createdAt, this.lastCheckedTimestamp),
                gt(jobs.id, this.lastCheckedId)
              )
            ),
            eq(jobs.isActive, 1)
          )
        )
        .orderBy(asc(jobs.createdAt), asc(jobs.id))
        .limit(100);

      if (newJobs.length > 0) {
        const newestJob = newJobs[newJobs.length - 1];
        this.lastCheckedTimestamp = newestJob.createdAt;
        this.lastCheckedId = newestJob.id;
        this.notifySubscribers(newJobs as JobSummary[]);
      }
    } catch (error) {
      console.error("[Discovery] Error checking for new jobs:", error);
    }
  }

  /**
   * Notify all subscribers of new jobs
   */
  private notifySubscribers(newJobs: JobSummary[]): void {
    for (const subscription of Array.from(this.subscriptions.values())) {
      const filteredJobs = this.filterJobsForUser(newJobs, subscription.filters);
      
      if (filteredJobs.length > 0) {
        const event: JobDiscoveryEvent = {
          type: "new_job",
          timestamp: new Date(),
          data: {
            jobs: filteredJobs,
            count: filteredJobs.length,
          },
        };
        
        try {
          subscription.callback(event);
        } catch (error) {
          console.error(`[Discovery] Error notifying user ${subscription.userId}:`, error);
        }
      }
    }
  }

  /**
   * Filter jobs based on user preferences
   */
  private filterJobsForUser(
    jobList: JobSummary[],
    filters: DiscoverySubscription["filters"]
  ): JobSummary[] {
    return jobList.filter((job) => {
      if (filters.keywords && filters.keywords.length > 0) {
        const titleLower = job.title.toLowerCase();
        const hasKeyword = filters.keywords.some((kw) =>
          titleLower.includes(kw.toLowerCase())
        );
        if (!hasKeyword) return false;
      }

      if (filters.locations && filters.locations.length > 0 && job.location) {
        const locationLower = job.location.toLowerCase();
        const hasLocation = filters.locations.some((loc) =>
          locationLower.includes(loc.toLowerCase())
        );
        if (!hasLocation) return false;
      }

      if (filters.platformIds && filters.platformIds.length > 0) {
        if (!filters.platformIds.includes(job.platformId)) return false;
      }

      if (filters.minSalary && job.salaryMin) {
        if (job.salaryMin < filters.minSalary) return false;
      }

      return true;
    });
  }

  /**
   * Manually trigger a check for new jobs
   */
  async triggerCheck(): Promise<JobSummary[]> {
    const db = await getDb();
    if (!db) return [];

    const recentJobs = await db
      .select({
        id: jobs.id,
        title: jobs.title,
        company: jobs.company,
        location: jobs.location,
        salaryMin: jobs.salaryMin,
        salaryMax: jobs.salaryMax,
        platformId: jobs.platformId,
        postedDate: jobs.postedDate,
      })
      .from(jobs)
      .where(eq(jobs.isActive, 1))
      .orderBy(desc(jobs.createdAt))
      .limit(50);

    return recentJobs as JobSummary[];
  }
}

// Singleton instance
let subscriptionManagerInstance: SubscriptionManager | null = null;

export function getSubscriptionManager(): SubscriptionManager {
  if (!subscriptionManagerInstance) {
    subscriptionManagerInstance = new SubscriptionManager();
  }
  return subscriptionManagerInstance;
}

// ============================================================================
// JOB DISCOVERY API
// ============================================================================

/**
 * Get recent jobs with optional filtering
 */
export async function getRecentJobs(options: {
  limit?: number;
  offset?: number;
  keywords?: string[];
  locations?: string[];
  platformIds?: number[];
  minSalary?: number;
  jobTypes?: string[];
  experienceLevels?: string[];
  postedAfter?: Date;
}): Promise<{ jobs: JobSummary[]; total: number }> {
  const db = await getDb();
  if (!db) {
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    let filteredJobs = sampleJobs.filter((job) => job.isActive === 1);

    if (options.keywords?.length) {
      filteredJobs = filteredJobs.filter((job) => {
        const searchable = `${job.title} ${job.company} ${job.description || ""} ${job.skills || ""}`.toLowerCase();
        return options.keywords!.some((keyword) => searchable.includes(keyword.toLowerCase()));
      });
    }
    if (options.locations?.length) {
      filteredJobs = filteredJobs.filter((job) => {
        const location = (job.location || "").toLowerCase();
        return options.locations!.some((item) => location.includes(item.toLowerCase()));
      });
    }
    if (options.platformIds?.length) {
      filteredJobs = filteredJobs.filter((job) => options.platformIds!.includes(job.platformId));
    }
    if (options.minSalary) {
      filteredJobs = filteredJobs.filter((job) => !job.salaryMin || job.salaryMin >= options.minSalary!);
    }

    const mappedJobs = filteredJobs
      .sort((a, b) => (b.postedDate?.getTime() || 0) - (a.postedDate?.getTime() || 0))
      .map((job) => ({
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        platformId: job.platformId,
        postedDate: job.postedDate,
      }));

    return { jobs: mappedJobs.slice(offset, offset + limit), total: filteredJobs.length };
  }

  const limit = options.limit || 20;
  const offset = options.offset || 0;

  const conditions = [eq(jobs.isActive, 1)];

  if (options.postedAfter) {
    conditions.push(gt(jobs.postedDate, options.postedAfter));
  }
  if (options.keywords?.length) {
    const keywordConditions = options.keywords.map((keyword) => {
      const pattern = `%${keyword}%`;
      return or(
        like(jobs.title, pattern),
        like(jobs.company, pattern),
        like(jobs.description, pattern),
        like(jobs.skills, pattern)
      );
    });
    conditions.push(or(...keywordConditions)!);
  }
  if (options.locations?.length) {
    conditions.push(or(...options.locations.map((location) =>
      like(jobs.location, `%${location}%`)
    ))!);
  }
  if (options.platformIds?.length) {
    conditions.push(inArray(jobs.platformId, options.platformIds));
  }
  if (options.minSalary) {
    conditions.push(or(
      sql`${jobs.salaryMin} IS NULL`,
      gte(jobs.salaryMin, options.minSalary)
    )!);
  }

  const jobList = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      company: jobs.company,
      location: jobs.location,
      salaryMin: jobs.salaryMin,
      salaryMax: jobs.salaryMax,
      platformId: jobs.platformId,
      postedDate: jobs.postedDate,
    })
    .from(jobs)
    .where(and(...conditions))
    .orderBy(desc(jobs.postedDate))
    .limit(limit)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobs)
    .where(and(...conditions));

  const total = countResult[0]?.count || 0;

  return { jobs: jobList as JobSummary[], total };
}

/**
 * Get job discovery statistics
 */
export async function getDiscoveryStats(): Promise<{
  totalJobs: number;
  jobsToday: number;
  jobsThisWeek: number;
  topPlatforms: Array<{ platformId: number; count: number }>;
  topLocations: Array<{ location: string; count: number }>;
}> {
  const db = await getDb();
  if (!db) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const activeJobs = sampleJobs.filter((job) => job.isActive === 1);
    return {
      totalJobs: activeJobs.length,
      jobsToday: activeJobs.filter((job) => job.createdAt > todayStart).length,
      jobsThisWeek: activeJobs.filter((job) => job.createdAt > weekStart).length,
      topPlatforms: Object.entries(
        activeJobs.reduce<Record<string, number>>((counts, job) => {
          counts[job.platformId] = (counts[job.platformId] || 0) + 1;
          return counts;
        }, {})
      ).map(([platformId, count]) => ({ platformId: Number(platformId), count })),
      topLocations: Object.entries(
        activeJobs.reduce<Record<string, number>>((counts, job) => {
          if (job.location) counts[job.location] = (counts[job.location] || 0) + 1;
          return counts;
        }, {})
      ).map(([location, count]) => ({ location, count })),
    };
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobs)
    .where(eq(jobs.isActive, 1));

  const todayResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobs)
    .where(and(eq(jobs.isActive, 1), gt(jobs.createdAt, todayStart)));

  const weekResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobs)
    .where(and(eq(jobs.isActive, 1), gt(jobs.createdAt, weekStart)));

  const platformsResult = await db
    .select({
      platformId: jobs.platformId,
      count: sql<number>`count(*)`,
    })
    .from(jobs)
    .where(eq(jobs.isActive, 1))
    .groupBy(jobs.platformId)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  const locationsResult = await db
    .select({
      location: jobs.location,
      count: sql<number>`count(*)`,
    })
    .from(jobs)
    .where(and(eq(jobs.isActive, 1), sql`${jobs.location} IS NOT NULL`))
    .groupBy(jobs.location)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  return {
    totalJobs: totalResult[0]?.count || 0,
    jobsToday: todayResult[0]?.count || 0,
    jobsThisWeek: weekResult[0]?.count || 0,
    topPlatforms: platformsResult.map((p) => ({
      platformId: p.platformId,
      count: Number(p.count),
    })),
    topLocations: locationsResult
      .filter((l) => l.location)
      .map((l) => ({
        location: l.location!,
        count: Number(l.count),
      })),
  };
}

/**
 * Search jobs with full-text search
 */
export async function searchJobs(query: string, options?: {
  limit?: number;
  offset?: number;
}): Promise<{ jobs: JobSummary[]; total: number }> {
  const db = await getDb();
  if (!db) {
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;
    const searchTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const scoredJobs = sampleJobs
      .map((job) => {
        const searchable = `${job.title} ${job.company} ${job.description || ""} ${job.skills || ""}`.toLowerCase();
        const score = searchTerms.reduce((total, term) => total + (searchable.includes(term) ? 1 : 0), 0);
        return { job, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    return {
      jobs: scoredJobs.slice(offset, offset + limit).map(({ job, score }) => ({
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        platformId: job.platformId,
        postedDate: job.postedDate,
        matchScore: score,
      })),
      total: scoredJobs.length,
    };
  }

  const limit = options?.limit || 20;
  const offset = options?.offset || 0;
  const searchTerms = query.toLowerCase().split(/\s+/).filter(Boolean);

  if (searchTerms.length === 0) {
    return getRecentJobs({ limit, offset });
  }

  const allJobs = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      company: jobs.company,
      location: jobs.location,
      salaryMin: jobs.salaryMin,
      salaryMax: jobs.salaryMax,
      platformId: jobs.platformId,
      postedDate: jobs.postedDate,
      description: jobs.description,
    })
    .from(jobs)
    .where(eq(jobs.isActive, 1))
    .orderBy(desc(jobs.postedDate));

  const scoredJobs = allJobs
    .map((job) => {
      const titleLower = job.title.toLowerCase();
      const companyLower = job.company.toLowerCase();
      const descLower = (job.description || "").toLowerCase();

      let score = 0;
      for (const term of searchTerms) {
        if (titleLower.includes(term)) score += 10;
        if (companyLower.includes(term)) score += 5;
        if (descLower.includes(term)) score += 1;
      }

      return { ...job, score };
    })
    .filter((job) => job.score > 0)
    .sort((a, b) => b.score - a.score);

  const total = scoredJobs.length;
  const paginatedJobs = scoredJobs.slice(offset, offset + limit);

  return {
    jobs: paginatedJobs.map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company,
      location: j.location,
      salaryMin: j.salaryMin,
      salaryMax: j.salaryMax,
      platformId: j.platformId,
      postedDate: j.postedDate,
      matchScore: j.score,
    })),
    total,
  };
}

// ============================================================================
// JOB ALERTS
// ============================================================================

export interface JobAlert {
  id: number;
  userId: number;
  name: string;
  keywords: string[];
  locations: string[];
  platformIds: number[];
  minSalary: number | null;
  jobTypes: string[];
  frequency: "instant" | "daily" | "weekly";
  isActive: boolean;
  lastTriggered: Date | null;
  createdAt: Date;
}

/**
 * Check if a job matches an alert
 */
export function jobMatchesAlert(job: JobSummary, alert: JobAlert): boolean {
  if (alert.keywords.length > 0) {
    const titleLower = job.title.toLowerCase();
    const hasKeyword = alert.keywords.some((kw) =>
      titleLower.includes(kw.toLowerCase())
    );
    if (!hasKeyword) return false;
  }

  if (alert.locations.length > 0 && job.location) {
    const locationLower = job.location.toLowerCase();
    const hasLocation = alert.locations.some((loc) =>
      locationLower.includes(loc.toLowerCase())
    );
    if (!hasLocation) return false;
  }

  if (alert.platformIds.length > 0) {
    if (!alert.platformIds.includes(job.platformId)) return false;
  }

  if (alert.minSalary && job.salaryMin) {
    if (job.salaryMin < alert.minSalary) return false;
  }

  return true;
}

/**
 * Process job alerts for new jobs
 */
export async function processJobAlerts(
  newJobs: JobSummary[],
  alerts: JobAlert[]
): Promise<Map<number, JobSummary[]>> {
  const userMatches = new Map<number, JobSummary[]>();

  for (const alert of alerts) {
    if (!alert.isActive) continue;

    const matchingJobs = newJobs.filter((job) => jobMatchesAlert(job, alert));

    if (matchingJobs.length > 0) {
      const existing = userMatches.get(alert.userId) || [];
      userMatches.set(alert.userId, [...existing, ...matchingJobs]);
    }
  }

  return userMatches;
}
