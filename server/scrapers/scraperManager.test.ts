import { describe, expect, it, vi } from "vitest";
import type { BaseScraper } from "./baseScraper";
import { ScraperManager } from "./scraperManager";

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
});
