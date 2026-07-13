import { describe, expect, it } from "vitest";
import { getScraperAdapterMetadata, getSupportedPlatforms } from "./index";
import {
  getMissingScraperPlatformCatalog,
  scraperPlatformCatalog,
} from "./platformCatalog";
import { samplePlatforms } from "../sampleData";

describe("scraper platform catalog", () => {
  it("covers every registered scraper with stable source metadata", () => {
    const catalogNames = scraperPlatformCatalog.map((platform) => platform.name);

    expect(catalogNames).toHaveLength(48);
    expect(new Set(catalogNames).size).toBe(catalogNames.length);
    expect(new Set(catalogNames)).toEqual(new Set(getSupportedPlatforms()));
    expect(scraperPlatformCatalog.every((platform) => platform.url.startsWith("https://"))).toBe(true);
  });

  it("keeps the database-free source configuration aligned with registered adapters", () => {
    expect(new Set(samplePlatforms.map((platform) => platform.name)))
      .toEqual(new Set(getSupportedPlatforms()));
    expect(new Set(samplePlatforms.map((platform) => platform.id)).size)
      .toBe(samplePlatforms.length);
  });

  it("returns only adapter sources that have not been configured yet", () => {
    const configured = ["RemoteOK", "FlexJobs", "Not a registered source"];
    const missing = getMissingScraperPlatformCatalog(configured);

    expect(missing.some((platform) => platform.name === "RemoteOK")).toBe(false);
    expect(missing.some((platform) => platform.name === "FlexJobs")).toBe(false);
    expect(missing).toHaveLength(scraperPlatformCatalog.length - 2);
  });

  it("reports dedicated and generic parser provenance for every registered source", () => {
    const adapters = getSupportedPlatforms().map((name) => ({ name, adapter: getScraperAdapterMetadata(name) }));

    expect(adapters.filter(({ adapter }) => adapter.kind === "dedicated")).toHaveLength(10);
    expect(adapters.filter(({ adapter }) => adapter.kind === "generic_rss").map(({ name }) => name))
      .toEqual(["NoDesk", "ProBlogger"]);
    expect(adapters.filter(({ adapter }) => adapter.kind === "generic_html")).toHaveLength(36);
    expect(adapters.every(({ adapter }) => adapter.label.endsWith("adapter"))).toBe(true);
    expect(adapters.filter(({ adapter }) => adapter.kind !== "dedicated")
      .every(({ adapter }) => adapter.detail.includes("coverage"))).toBe(true);
  });
});
