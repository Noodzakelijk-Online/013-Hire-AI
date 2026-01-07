import { getScraperManager } from "./scraperManager";
import { getDb } from "../db";
import { jobs, jobPlatforms } from "../../drizzle/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Job Scraping Scheduler
 * Manages automated job scraping on a schedule
 */

interface SchedulerConfig {
  intervalMinutes: number;
  maxJobsPerRun: number;
  enabledPlatforms?: string[];
}

interface SchedulerStatus {
  isRunning: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  totalJobsScraped: number;
  totalRunsCompleted: number;
  errors: string[];
}

class JobScrapingScheduler {
  private config: SchedulerConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private status: SchedulerStatus = {
    isRunning: false,
    lastRunAt: null,
    nextRunAt: null,
    totalJobsScraped: 0,
    totalRunsCompleted: 0,
    errors: [],
  };

  constructor(config: SchedulerConfig) {
    this.config = config;
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.intervalId) {
      console.log("[Scheduler] Already running");
      return;
    }

    console.log(`[Scheduler] Starting with ${this.config.intervalMinutes} minute interval`);
    
    // Run immediately
    this.runScraping();

    // Schedule recurring runs
    this.intervalId = setInterval(
      () => this.runScraping(),
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
      
      const result = await manager.runScrapingCycle({
        limit: this.config.maxJobsPerRun,
      });

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
    return { ...this.status };
  }

  /**
   * Update scheduler configuration
   */
  updateConfig(config: Partial<SchedulerConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Restart if running with new interval
    if (this.intervalId && config.intervalMinutes) {
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
  }
  return schedulerInstance;
}

/**
 * Job deduplication service
 * Uses TF-IDF and cosine similarity for advanced deduplication
 */
export class JobDeduplicator {
  private vocabulary: Map<string, number> = new Map();
  private idfScores: Map<string, number> = new Map();

  /**
   * Calculate TF-IDF vector for a job
   */
  private calculateTFIDF(text: string): Map<string, number> {
    const words = this.tokenize(text);
    const tf = new Map<string, number>();
    
    // Calculate term frequency
    for (const word of words) {
      tf.set(word, (tf.get(word) || 0) + 1);
    }
    
    // Normalize by document length
    for (const [word, count] of Array.from(tf.entries())) {
      tf.set(word, count / words.length);
    }
    
    // Apply IDF
    const tfidf = new Map<string, number>();
    for (const [word, tfScore] of Array.from(tf.entries())) {
      const idf = this.idfScores.get(word) || 1;
      tfidf.set(word, tfScore * idf);
    }
    
    return tfidf;
  }

  /**
   * Calculate cosine similarity between two TF-IDF vectors
   */
  private cosineSimilarity(vec1: Map<string, number>, vec2: Map<string, number>): number {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (const [word, score] of Array.from(vec1.entries())) {
      norm1 += score * score;
      if (vec2.has(word)) {
        dotProduct += score * vec2.get(word)!;
      }
    }
    
    for (const score of Array.from(vec2.values())) {
      norm2 += score * score;
    }
    
    if (norm1 === 0 || norm2 === 0) return 0;
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Tokenize text into words
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(word => word.length > 2);
  }

  /**
   * Build vocabulary and IDF scores from existing jobs
   */
  async buildVocabulary(): Promise<void> {
    const db = await getDb();
    if (!db) return;

    const existingJobs = await db
      .select({ title: jobs.title, description: jobs.description })
      .from(jobs)
      .limit(10000);

    const documentCount = existingJobs.length;
    const wordDocCount = new Map<string, number>();

    // Count documents containing each word
    for (const job of existingJobs) {
      const text = `${job.title || ""} ${job.description || ""}`;
      const uniqueWords = new Set(this.tokenize(text));
      
      for (const word of Array.from(uniqueWords)) {
        wordDocCount.set(word, (wordDocCount.get(word) || 0) + 1);
      }
    }

    // Calculate IDF scores
    for (const [word, count] of Array.from(wordDocCount.entries())) {
      this.idfScores.set(word, Math.log(documentCount / count));
      this.vocabulary.set(word, this.vocabulary.size);
    }

    console.log(`[Deduplicator] Built vocabulary with ${this.vocabulary.size} terms from ${documentCount} jobs`);
  }

  /**
   * Check if a job is a duplicate of existing jobs
   */
  async isDuplicate(newJob: { title?: string | null; description?: string | null; company?: string | null }): Promise<{
    isDuplicate: boolean;
    similarity: number;
    matchedJobId?: number;
  }> {
    const db = await getDb();
    if (!db) return { isDuplicate: false, similarity: 0 };

    const newText = `${newJob.title || ""} ${newJob.description || ""}`;
    const newVector = this.calculateTFIDF(newText);

    // Get recent jobs from same company for comparison
    const recentJobs = await db
      .select()
      .from(jobs)
      .where(newJob.company ? eq(jobs.company, newJob.company) : sql`1=1`)
      .limit(100);

    let maxSimilarity = 0;
    let matchedJobId: number | undefined;

    for (const existingJob of recentJobs) {
      const existingText = `${existingJob.title || ""} ${existingJob.description || ""}`;
      const existingVector = this.calculateTFIDF(existingText);
      
      const similarity = this.cosineSimilarity(newVector, existingVector);
      
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        matchedJobId = existingJob.id;
      }
    }

    // Consider duplicate if similarity > 0.85
    const isDuplicate = maxSimilarity > 0.85;

    return {
      isDuplicate,
      similarity: maxSimilarity,
      matchedJobId: isDuplicate ? matchedJobId : undefined,
    };
  }
}

// Singleton deduplicator
let deduplicatorInstance: JobDeduplicator | null = null;

export async function getDeduplicator(): Promise<JobDeduplicator> {
  if (!deduplicatorInstance) {
    deduplicatorInstance = new JobDeduplicator();
    await deduplicatorInstance.buildVocabulary();
  }
  return deduplicatorInstance;
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
