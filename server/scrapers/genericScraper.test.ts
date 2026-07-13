import { afterEach, describe, expect, it, vi } from "vitest";
import { GenericScraper } from "./genericScraper";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("generic scraper structured job extraction", () => {
  it("normalizes JSON-LD JobPosting data before falling back to HTML heuristics", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <script type="application/ld+json">
          {"@context":"https://schema.org","@graph":[{
            "@type":"JobPosting",
            "title":"Senior Platform Engineer",
            "description":"<p>Build reliable remote systems.</p>",
            "url":"/jobs/platform-engineer",
            "datePosted":"2026-07-13T10:00:00.000Z",
            "validThrough":"2026-08-13T10:00:00.000Z",
            "employmentType":"FULL_TIME",
            "identifier":{"value":"platform-123"},
            "hiringOrganization":{"name":"Example Systems"},
            "jobLocationType":"TELECOMMUTE",
            "baseSalary":{"currency":"USD","value":{"minValue":"140000","maxValue":180000}}
          }]}
        </script>
      `,
    }) as typeof fetch;
    const scraper = new GenericScraper({
      platformName: "Structured Test Source",
      platformId: 72,
      baseUrl: "https://jobs.example.com",
      rateLimit: 0,
      maxRetries: 0,
      type: "html",
    });

    const result = await scraper.scrape();

    expect(result.errors).toEqual([]);
    expect(result.jobs).toEqual([expect.objectContaining({
      platformId: 72,
      title: "Senior Platform Engineer",
      company: "Example Systems",
      location: "Remote",
      description: "Build reliable remote systems.",
      applicationUrl: "https://jobs.example.com/jobs/platform-engineer",
      externalId: "platform-123",
      jobType: "full-time",
      salaryMin: 140000,
      salaryMax: 180000,
      salaryCurrency: "USD",
      expiryDate: new Date("2026-08-13T10:00:00.000Z"),
    })]);
  });

  it("ignores malformed structured data and retains the heuristic HTML fallback", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '<script type="application/ld+json">{not-json}</script><article class="job"><h2>Fallback Engineer</h2><a href="/jobs/fallback">Apply</a></article>',
    }) as typeof fetch;
    const scraper = new GenericScraper({
      platformName: "Fallback Test Source",
      platformId: 73,
      baseUrl: "https://jobs.example.com",
      rateLimit: 0,
      maxRetries: 0,
      type: "html",
    });

    const result = await scraper.scrape();

    expect(result.errors).toEqual([]);
    expect(result.jobs[0]).toMatchObject({
      title: "Fallback Engineer",
      applicationUrl: "https://jobs.example.com/jobs/fallback",
    });
  });
});
