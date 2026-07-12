import { describe, expect, it } from "vitest";
import { getLocationPreferenceFit } from "../shared/locationEligibility";

describe("location eligibility", () => {
  it("blocks remote roles restricted to a different region", () => {
    expect(getLocationPreferenceFit("Remote - US Only", "Europe")).toBe("gap");
  });

  it("accepts worldwide remote listings for a regional search", () => {
    expect(getLocationPreferenceFit("Remote - Worldwide", "Europe")).toBe("fit");
  });

  it("matches country preferences through their region", () => {
    expect(getLocationPreferenceFit("Remote - Europe", "Netherlands")).toBe("fit");
  });

  it("keeps unscoped remote listings reviewable when geography is unknown", () => {
    expect(getLocationPreferenceFit("Remote", "Europe")).toBe("partial");
  });
});
