import { BaseScraper, type ScrapeResult, type ScraperConfig } from "./baseScraper";

/**
 * Generic scraper that can be configured for different platforms
 * Uses common patterns for RSS feeds and HTML scraping
 */
export class GenericScraper extends BaseScraper {
  private scraperType: "rss" | "html" | "api";
  private feedUrl?: string;
  private apiUrl?: string;
  private selectors: {
    jobCard?: string;
    title?: string;
    company?: string;
    location?: string;
    link?: string;
    description?: string;
  };

  constructor(
    config: ScraperConfig & {
      type: "rss" | "html" | "api";
      feedUrl?: string;
      apiUrl?: string;
      selectors?: {
        jobCard?: string;
        title?: string;
        company?: string;
        location?: string;
        link?: string;
        description?: string;
      };
    }
  ) {
    super(config);
    this.scraperType = config.type;
    this.feedUrl = config.feedUrl;
    this.apiUrl = config.apiUrl;
    this.selectors = config.selectors || {};
  }

  async scrape(options?: {
    keywords?: string;
    location?: string;
    limit?: number;
  }): Promise<ScrapeResult> {
    switch (this.scraperType) {
      case "rss":
        return this.scrapeRSS(options);
      case "api":
        return this.scrapeAPI(options);
      case "html":
      default:
        return this.scrapeHTML(options);
    }
  }

  private async scrapeRSS(options?: {
    keywords?: string;
    location?: string;
    limit?: number;
  }): Promise<ScrapeResult> {
    const errors: string[] = [];
    const jobs: any[] = [];

    try {
      this.log("Starting RSS scrape...");
      await this.rateLimit();

      const url = this.feedUrl || `${this.config.baseUrl}/feed/`;

      const response = await this.retry(async () => {
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Hire.AI Job Aggregator",
            "Accept": "application/rss+xml, application/xml, text/xml, */*",
          },
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        return res.text();
      });

      const parsedJobs = this.parseRSS(response);

      for (const rawJob of parsedJobs) {
        if (options?.keywords) {
          const keywords = options.keywords.toLowerCase();
          const title = (rawJob.title || "").toLowerCase();
          const description = (rawJob.description || "").toLowerCase();

          if (!title.includes(keywords) && !description.includes(keywords)) {
            continue;
          }
        }

        const normalizedJob = this.normalizeJob(rawJob);
        jobs.push(normalizedJob);

        if (options?.limit && jobs.length >= options.limit) {
          break;
        }
      }

      this.log(`Successfully scraped ${jobs.length} jobs`);
    } catch (error) {
      const errorMsg = `RSS scraping failed: ${error}`;
      this.log(errorMsg, "error");
      errors.push(errorMsg);
    }

    return { jobs, errors, scrapedAt: new Date() };
  }

  private async scrapeAPI(options?: {
    keywords?: string;
    location?: string;
    limit?: number;
  }): Promise<ScrapeResult> {
    const errors: string[] = [];
    const jobs: any[] = [];

    try {
      this.log("Starting API scrape...");
      await this.rateLimit();

      let url = this.apiUrl || this.config.baseUrl;
      if (options?.keywords) {
        url += `?q=${encodeURIComponent(options.keywords)}`;
      }

      const response = await this.retry(async () => {
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Hire.AI Job Aggregator",
            "Accept": "application/json",
          },
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        return res.json();
      });

      const rawJobs = Array.isArray(response) ? response : response.jobs || response.data || [];

      for (const rawJob of rawJobs) {
        const normalizedJob = this.normalizeJob({
          title: rawJob.title || rawJob.name,
          company: rawJob.company || rawJob.company_name || rawJob.employer,
          location: rawJob.location || "Remote",
          description: rawJob.description || rawJob.content,
          applicationUrl: rawJob.url || rawJob.link || rawJob.apply_url,
          externalId: rawJob.id?.toString() || rawJob.slug,
          postedDate: rawJob.date || rawJob.published_at || rawJob.created_at,
        });

        jobs.push(normalizedJob);

        if (options?.limit && jobs.length >= options.limit) {
          break;
        }
      }

      this.log(`Successfully scraped ${jobs.length} jobs`);
    } catch (error) {
      const errorMsg = `API scraping failed: ${error}`;
      this.log(errorMsg, "error");
      errors.push(errorMsg);
    }

    return { jobs, errors, scrapedAt: new Date() };
  }

  private async scrapeHTML(options?: {
    keywords?: string;
    location?: string;
    limit?: number;
  }): Promise<ScrapeResult> {
    const errors: string[] = [];
    const jobs: any[] = [];

    try {
      this.log("Starting HTML scrape...");
      await this.rateLimit();

      const response = await this.retry(async () => {
        const res = await fetch(this.config.baseUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        return res.text();
      });

      // Generic HTML parsing - looks for common job listing patterns
      const parsedJobs = this.parseHTML(response);

      for (const rawJob of parsedJobs) {
        if (options?.keywords) {
          const keywords = options.keywords.toLowerCase();
          const title = (rawJob.title || "").toLowerCase();

          if (!title.includes(keywords)) {
            continue;
          }
        }

        const normalizedJob = this.normalizeJob(rawJob);
        jobs.push(normalizedJob);

        if (options?.limit && jobs.length >= options.limit) {
          break;
        }
      }

      this.log(`Successfully scraped ${jobs.length} jobs`);
    } catch (error) {
      const errorMsg = `HTML scraping failed: ${error}`;
      this.log(errorMsg, "error");
      errors.push(errorMsg);
    }

    return { jobs, errors, scrapedAt: new Date() };
  }

  private parseRSS(xml: string): any[] {
    const jobs: any[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1];
      
      const title = this.extractTag(itemXml, "title");
      const link = this.extractTag(itemXml, "link");
      const description = this.extractTag(itemXml, "description");
      const pubDate = this.extractTag(itemXml, "pubDate");
      const guid = this.extractTag(itemXml, "guid");

      // Try to extract company from title
      let company = `Company via ${this.config.platformName}`;
      let jobTitle = title;
      
      if (title.includes(" at ")) {
        const parts = title.split(" at ");
        jobTitle = parts[0].trim();
        company = parts.slice(1).join(" at ").trim();
      } else if (title.includes(" - ")) {
        const parts = title.split(" - ");
        if (parts.length >= 2) {
          jobTitle = parts[0].trim();
          company = parts[1].trim();
        }
      }

      jobs.push({
        title: jobTitle,
        company,
        location: "Remote",
        description: this.cleanHtml(description),
        applicationUrl: link,
        externalId: guid || link,
        postedDate: pubDate ? new Date(pubDate) : undefined,
      });
    }

    return jobs;
  }

  private parseHTML(html: string): any[] {
    const jobs: any[] = [];

    // Try common job card patterns
    const patterns = [
      /<article[^>]*class="[^"]*job[^"]*"[^>]*>([\s\S]*?)<\/article>/gi,
      /<div[^>]*class="[^"]*job-card[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi,
      /<li[^>]*class="[^"]*job[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
      /<a[^>]*class="[^"]*job[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const content = match[1] || match[2] || "";
        const link = match[1]?.startsWith("http") ? match[1] : this.extractLink(content);

        const title = this.extractFromHtml(content, ["h2", "h3", "title", "job-title"]);
        const company = this.extractFromHtml(content, ["company", "employer", "organization"]);

        if (title && link) {
          jobs.push({
            title: this.cleanHtml(title),
            company: company ? this.cleanHtml(company) : `Company via ${this.config.platformName}`,
            location: "Remote",
            applicationUrl: link.startsWith("http") ? link : `${this.config.baseUrl}${link}`,
            externalId: link,
          });
        }
      }

      if (jobs.length > 0) break;
    }

    return jobs;
  }

  private extractTag(xml: string, tag: string): string {
    const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
    const match = xml.match(regex);
    return match ? (match[1] || match[2] || "").trim() : "";
  }

  private extractLink(html: string): string {
    const match = html.match(/href="([^"]+)"/);
    return match ? match[1] : "";
  }

  private extractFromHtml(html: string, classNames: string[]): string {
    for (const className of classNames) {
      const regex = new RegExp(`class="[^"]*${className}[^"]*"[^>]*>([^<]+)`, "i");
      const match = html.match(regex);
      if (match) return match[1].trim();

      const tagRegex = new RegExp(`<${className}[^>]*>([^<]+)<\/${className}>`, "i");
      const tagMatch = html.match(tagRegex);
      if (tagMatch) return tagMatch[1].trim();
    }
    return "";
  }

  private cleanHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
  }
}
