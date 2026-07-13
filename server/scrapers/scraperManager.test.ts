import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BaseScraper } from "./baseScraper";
import { ScraperManager } from "./scraperManager";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  updatePlatformLastScraped: vi.fn(),
}));

vi.mock("../db", () => ({
  getDb: mocks.getDb,
  updatePlatformLastScraped: mocks.updatePlatformLastScraped,
}));

function createScraper(platformId: number) {
  return {
    getPlatformId: () => platformId,
    scrape: vi.fn().mockResolvedValue({
      jobs: [],
      errors: [],
      scrapedAt: new Date(),
    }),
  } as unknown as BaseScraper;
}

describe("scraper manager platform restrictions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockResolvedValue(null);
    mocks.updatePlatformLastScraped.mockResolvedValue(undefined);
  });

  it("runs only the explicitly enabled platform sources", async () => {
    const manager = new ScraperManager();
    const remoteOk = createScraper(1);
    const remotive = createScraper(2);
    const scrapers = (manager as unknown as { scrapers: Map<string, BaseScraper> }).scrapers;
    scrapers.set("RemoteOK", remoteOk);
    scrapers.set("Remotive", remotive);

    const result = await manager.scrapeAll({ platformNames: ["RemoteOK"] });

    expect(remoteOk.scrape).toHaveBeenCalledOnce();
    expect(remotive.scrape).not.toHaveBeenCalled();
    expect(Object.keys(result.platformResults)).toEqual(["RemoteOK"]);
    expect(manager.getInitializedPlatforms()).toEqual(["RemoteOK", "Remotive"]);
  });

  it("reports an unavailable configured platform without scraping another source", async () => {
    const manager = new ScraperManager();
    const remoteOk = createScraper(1);
    const scrapers = (manager as unknown as { scrapers: Map<string, BaseScraper> }).scrapers;
    scrapers.set("RemoteOK", remoteOk);

    const result = await manager.scrapeAll({ platformNames: ["Unavailable Board"] });

    expect(remoteOk.scrape).not.toHaveBeenCalled();
    expect(result.platformResults["Unavailable Board"].errors).toEqual([
      "No scraper available for platform: Unavailable Board",
    ]);
    expect(manager.getInitializationError("Unavailable Board")).toBeNull();
  });

  it("refreshes a re-observed source listing instead of leaving an expired record unavailable", async () => {
    const existingJob = {
      id: 712,
      externalId: "source-job-712",
      platformId: 7,
      title: "Senior Platform Engineer",
      company: "Source Co",
      description: "Older description",
      requirements: null,
      responsibilities: null,
      benefits: null,
      location: "Remote",
      jobType: "full-time",
      salaryMin: 120000,
      salaryMax: 160000,
      salaryCurrency: "USD",
      skills: "TypeScript",
      applicationUrl: "https://jobs.example.com/712",
      applicationEmail: null,
      applicationProcess: null,
      sourceUrl: null,
      postedDate: new Date("2026-07-01T00:00:00.000Z"),
      expiryDate: new Date("2026-07-10T00:00:00.000Z"),
      isActive: 0,
      visaSponsorshipAvailable: 0,
      openHiringSupport: 0,
      diversityFriendly: 0,
    };
    const where = vi.fn().mockResolvedValue([{ affectedRows: 1 }]);
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    const selectResponses = [[existingJob], []];
    const limit = vi.fn().mockImplementation(() => Promise.resolve(selectResponses.shift() || []));
    const selectWhere = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where: selectWhere }));
    const select = vi.fn(() => ({ from }));
    mocks.getDb.mockResolvedValue({ select, update });

    const result = await new ScraperManager().saveJobs([{
      externalId: "source-job-712",
      platformId: 7,
      title: "Senior Platform Engineer",
      company: "Source Co",
      description: "Updated source description",
      applicationUrl: "https://jobs.example.com/712?source=refresh",
      isActive: 1,
    }]);

    expect(result).toEqual({ saved: 0, refreshed: 1, duplicates: 0, errors: 0 });
    expect(update).toHaveBeenCalledOnce();
    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      title: "Senior Platform Engineer",
      description: "Updated source description",
      applicationUrl: "https://jobs.example.com/712?source=refresh",
      expiryDate: null,
      isActive: 1,
    }));
  });

  it("reactivates an expired canonical listing when a linked source is re-observed", async () => {
    const duplicate = {
      id: 714,
      externalId: "source-job-714",
      platformId: 7,
      title: "Staff Data Engineer",
      company: "Source Co",
      expiryDate: new Date("2026-07-10T00:00:00.000Z"),
      isActive: 0,
    };
    const primary = {
      ...duplicate,
      id: 713,
      externalId: "canonical-job-713",
      platformId: 6,
      applicationUrl: "https://old-source.example.com/713",
    };
    const where = vi.fn().mockResolvedValue([{ affectedRows: 1 }]);
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    const selectResponses = [
      [duplicate],
      [{ primaryJobId: primary.id }],
      [primary],
    ];
    const select = vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockImplementation(() => Promise.resolve(selectResponses.shift() || [])),
        }),
      }),
    }));
    mocks.getDb.mockResolvedValue({ select, update });

    const result = await new ScraperManager().saveJobs([{
      externalId: "source-job-714",
      platformId: 7,
      title: "Staff Data Engineer",
      company: "Source Co",
      applicationUrl: "https://fresh-source.example.com/714",
      isActive: 1,
    }]);

    expect(result).toEqual({ saved: 0, refreshed: 1, duplicates: 0, errors: 0 });
    expect(update).toHaveBeenCalledTimes(2);
    expect(set).toHaveBeenLastCalledWith(expect.objectContaining({
      applicationUrl: "https://fresh-source.example.com/714",
      expiryDate: null,
      isActive: 1,
    }));
  });
});
