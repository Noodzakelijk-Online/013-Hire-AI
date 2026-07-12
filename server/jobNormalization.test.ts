import { describe, expect, it } from "vitest";
import { normalizeLocation, normalizeSalary } from "./jobNormalization";

describe("job normalization", () => {
  it("keeps explicit CAD and AUD compensation distinct from generic dollar salaries", () => {
    expect(normalizeSalary("CAD $100k - $120k per year")).toMatchObject({
      currency: "CAD",
      min: 100000,
      max: 120000,
      period: "yearly",
    });
    expect(normalizeSalary("A$85k - A$95k")).toMatchObject({
      currency: "AUD",
      min: 85000,
      max: 95000,
    });
  });

  it("recognizes complete country names without treating city text as a country code", () => {
    expect(normalizeLocation("Remote - Berlin, Germany")).toMatchObject({
      country: "Germany",
      region: "Europe",
      isRemote: true,
    });
    expect(normalizeLocation("Remote - Canada")).toMatchObject({
      country: "Canada",
      region: "North America",
      isRemote: true,
    });
    expect(normalizeLocation("Remote - Berlin")).toMatchObject({
      country: "Worldwide",
      region: "Global",
      isRemote: true,
    });
  });
});
