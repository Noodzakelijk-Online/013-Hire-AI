import { describe, expect, it } from "vitest";
import {
  MAX_LISTING_OBSERVATION_AGE_MS,
  isJobListingCurrent,
} from "../shared/jobListingFreshness";

const now = new Date("2026-07-13T12:00:00.000Z");

describe("job listing freshness", () => {
  it("accepts a current active listing that was recently re-observed", () => {
    expect(isJobListingCurrent({
      isActive: 1,
      expiryDate: null,
      updatedAt: new Date(now.getTime() - 60_000),
    }, now)).toBe(true);
  });

  it("rejects a no-expiry listing after the source observation window", () => {
    expect(isJobListingCurrent({
      isActive: 1,
      expiryDate: null,
      updatedAt: new Date(now.getTime() - MAX_LISTING_OBSERVATION_AGE_MS - 1),
    }, now)).toBe(false);
  });

  it("uses a provider expiry when one is available", () => {
    expect(isJobListingCurrent({
      isActive: 1,
      expiryDate: new Date(now.getTime() + 60_000),
      updatedAt: new Date(now.getTime() - MAX_LISTING_OBSERVATION_AGE_MS - 1),
    }, now)).toBe(true);
    expect(isJobListingCurrent({
      isActive: 1,
      expiryDate: new Date(now.getTime() - 60_000),
      updatedAt: now,
    }, now)).toBe(false);
  });
});
