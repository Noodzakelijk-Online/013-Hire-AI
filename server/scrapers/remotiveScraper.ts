import { BaseScraper, type ScrapeResult } from "./baseScraper";

/**
 * Remotive scraper
 * Scrapes jobs from remotive.com using their public API
 */
export class RemotiveScraper extends BaseScraper {
  constructor(platformId: number) {
    super({
      platformName: "Remotive",
      platformId,
      baseUrl: "https://remotive.com/api/remote-jobs",
      rateLimit: 2000,
      maxRetries: 3,
    });
  }

  async scrape(options?: {
    keywords?: string;
    location?: string;
    limit?: number;
  }): Promise<ScrapeResult> {
    const errors: string[] = [];
    const jobs: any[] = [];

    try {
      this.log("Starting scrape...");
      await this.rateLimit();

      // Remotive has a public API
      let url = this.config.baseUrl;
      if (options?.keywords) {
        url += `?search=${encodeURIComponent(options.keywords)}`;
      }

      const response = await this.retry(async () => {
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Hire.AI Job Aggregator",
          },
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        return res.json();
      });

      const rawJobs = response.jobs || [];
      this.log(`Found ${rawJobs.length} jobs`);

      for (const rawJob of rawJobs) {
        try {
          const normalizedJob = this.normalizeJob({
            title: rawJob.title,
            company: rawJob.company_name,
            location: rawJob.candidate_required_location || "Remote",
            description: rawJob.description,
            skills: rawJob.tags?.join(", "),
            jobType: rawJob.job_type,
            applicationUrl: rawJob.url,
            externalId: rawJob.id?.toString(),
            postedDate: rawJob.publication_date ? new Date(rawJob.publication_date) : undefined,
            salaryMin: this.extractSalary(rawJob.salary, "min"),
            salaryMax: this.extractSalary(rawJob.salary, "max"),
          });

          jobs.push(normalizedJob);

          if (options?.limit && jobs.length >= options.limit) {
            break;
          }
        } catch (error) {
          const errorMsg = `Failed to parse job: ${error}`;
          this.log(errorMsg, "error");
          errors.push(errorMsg);
        }
      }

      this.log(`Successfully scraped ${jobs.length} jobs`);
    } catch (error) {
      const errorMsg = `Scraping failed: ${error}`;
      this.log(errorMsg, "error");
      errors.push(errorMsg);
    }

    return {
      jobs,
      errors,
      scrapedAt: new Date(),
    };
  }

  private extractSalary(salaryStr: string | undefined, type: "min" | "max"): number | undefined {
    if (!salaryStr) return undefined;

    // Parse salary strings like "$100,000 - $150,000" or "$120k"
    const numbers = salaryStr.match(/[\d,]+k?/gi);
    if (!numbers || numbers.length === 0) return undefined;

    const parseNum = (str: string): number => {
      const cleaned = str.replace(/,/g, "").toLowerCase();
      if (cleaned.endsWith("k")) {
        return parseFloat(cleaned.slice(0, -1)) * 1000;
      }
      return parseFloat(cleaned);
    };

    if (type === "min") {
      return parseNum(numbers[0]);
    } else {
      return numbers.length > 1 ? parseNum(numbers[1]) : parseNum(numbers[0]);
    }
  }
}
