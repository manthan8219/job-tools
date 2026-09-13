import { describe, it, expect } from "vitest";
import { isLocationInCountry, normalizeCountryCode } from "../../src/scrapers/utils/countryUtils.js";

describe("Country Matching Utilities", () => {
  it("should match Germany by country name, code, or major cities", () => {
    expect(isLocationInCountry("Munich, Germany", "Germany")).toBe(true);
    expect(isLocationInCountry("Berlin, Deutschland", "DE")).toBe(true);
    expect(isLocationInCountry("Remote - Germany", "de")).toBe(true);
    expect(isLocationInCountry("Frankfurt am Main", "Germany")).toBe(true);
    expect(isLocationInCountry("London, UK", "Germany")).toBe(false);
  });

  it("should match Canada by country name, code, or provinces/cities", () => {
    expect(isLocationInCountry("Toronto, Ontario, Canada", "Canada")).toBe(true);
    expect(isLocationInCountry("Vancouver, BC", "CA")).toBe(true);
    expect(isLocationInCountry("Montreal, QC", "Canada")).toBe(true);
    expect(isLocationInCountry("Remote (United States | Canada)", "CA")).toBe(true);
    expect(isLocationInCountry("Paris, France", "Canada")).toBe(false);
  });

  it("should match USA by country name, code, or states/cities", () => {
    expect(isLocationInCountry("San Francisco, CA", "USA")).toBe(true);
    expect(isLocationInCountry("New York, NY", "US")).toBe(true);
    expect(isLocationInCountry("Austin, Texas, United States", "United States")).toBe(true);
    expect(isLocationInCountry("Berlin, Germany", "USA")).toBe(false);
  });

  it("should always match Worldwide / Anywhere when location is open worldwide", () => {
    expect(isLocationInCountry("Worldwide (Remote)", "Germany")).toBe(true);
    expect(isLocationInCountry("Anywhere", "Canada")).toBe(true);
  });

  it("should correctly normalize country codes", () => {
    expect(normalizeCountryCode("germany")).toBe("DE");
    expect(normalizeCountryCode("canada")).toBe("CA");
    expect(normalizeCountryCode("united states")).toBe("US");
    expect(normalizeCountryCode("uk")).toBe("GB");
  });
});
