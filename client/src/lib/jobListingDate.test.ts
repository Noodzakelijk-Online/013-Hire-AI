import { describe, expect, it } from "vitest";
import { getJobListingDate } from "./jobListingDate";

describe("job listing dates", () => {
  it("uses the provider posting date when available", () => {
    const listingDate = getJobListingDate({
      postedDate: "2026-07-12T10:30:00.000Z",
      createdAt: "2026-07-13T10:30:00.000Z",
    });

    expect(listingDate).toMatchObject({ source: "posted" });
    expect(listingDate?.date.toISOString()).toBe("2026-07-12T10:30:00.000Z");
  });

  it("labels a valid discovery fallback without presenting it as posted", () => {
    const listingDate = getJobListingDate({
      postedDate: "not-a-date",
      createdAt: "2026-07-13T10:30:00.000Z",
    });

    expect(listingDate).toMatchObject({ source: "discovered" });
    expect(listingDate?.date.toISOString()).toBe("2026-07-13T10:30:00.000Z");
  });

  it("does not invent a listing date when the source data is invalid", () => {
    expect(
      getJobListingDate({ postedDate: "invalid", createdAt: null })
    ).toBeNull();
  });
});
