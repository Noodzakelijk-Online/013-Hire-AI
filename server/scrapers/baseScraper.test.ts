import { describe, expect, it } from "vitest";
import { BaseScraper, type ScrapeResult } from "./baseScraper";

class TestScraper extends BaseScraper {
  async scrape(): Promise<ScrapeResult> {
    return { jobs: [], errors: [], scrapedAt: new Date() };
  }

  normalize(rawJob: unknown) {
    return this.normalizeJob(rawJob);
  }
}

describe("base scraper application-link normalization", () => {
  const scraper = new TestScraper({
    platformName: "Test source",
    platformId: 991,
    baseUrl: "https://jobs.example.com/careers/",
    rateLimit: 0,
    maxRetries: 0,
  });

  it("resolves relative application links against the source URL", () => {
    expect(scraper.normalize({ title: "Engineer", applicationUrl: "roles/engineer" }))
      .toMatchObject({ applicationUrl: "https://jobs.example.com/careers/roles/engineer" });
  });

  it("omits non-web application links instead of preserving executable schemes", () => {
    expect(scraper.normalize({ title: "Engineer", applicationUrl: "javascript:alert(1)" }))
      .toMatchObject({ applicationUrl: undefined });
  });

  it("preserves locale-formatted compensation for downstream match and filter decisions", () => {
    expect(scraper.normalize({
      title: "European Engineer",
      salaryMin: "EUR 60.000",
      salaryMax: "EUR 75 000",
      salaryCurrency: "eur",
    })).toMatchObject({
      salaryMin: 60000,
      salaryMax: 75000,
      salaryCurrency: "EUR",
    });
  });
});
