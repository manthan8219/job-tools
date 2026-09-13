/**
 * Country code and alias mapping for international abroad job scraping
 */
const COUNTRY_ALIASES: Record<string, string[]> = {
  DE: ["germany", "de", "deutschland", "berlin", "munich", "münchen", "frankfurt", "hamburg", "cologne", "köln", "stuttgart"],
  CA: ["canada", "toronto", "vancouver", "montreal", "montréal", "ottawa", "calgary", "waterloo", "quebec", "ontario", "british columbia", "alberta", "bc, canada", "on, canada"],
  US: ["usa", "us", "united states", "america", "san francisco", "new york", "nyc", "austin", "seattle", "boston", "chicago", "los angeles", "california", "texas"],
  GB: ["uk", "gb", "united kingdom", "britain", "england", "scotland", "wales", "london", "manchester", "edinburgh", "cambridge", "oxford", "birmingham", "bristol"],
  IN: ["india", "in", "bangalore", "bengaluru", "hyderabad", "mumbai", "pune", "delhi", "noida", "gurgaon", "chennai"],
  AU: ["australia", "au", "sydney", "melbourne", "brisbane", "perth"],
  NL: ["netherlands", "holland", "nl", "amsterdam", "rotterdam", "utrecht", "eindhoven"],
  FR: ["france", "fr", "paris", "lyon", "toulouse"],
  CH: ["switzerland", "ch", "zurich", "zürich", "geneva", "genève", "lausanne"],
  SG: ["singapore", "sg"],
  IE: ["ireland", "ie", "dublin", "cork"],
};

/**
 * Normalizes user-inputted country strings to ISO alpha-2 codes where possible
 */
export function normalizeCountryCode(countryStr: string): string {
  const clean = countryStr.toLowerCase().trim();

  if (clean === "ca") return "CA";

  for (const [code, aliases] of Object.entries(COUNTRY_ALIASES)) {
    if (code.toLowerCase() === clean || aliases.includes(clean)) {
      return code;
    }
  }

  return clean.toUpperCase();
}

/**
 * Checks whether a given location string matches a requested country query.
 * Worldwide / Anywhere locations are considered matching any country.
 */
export function isLocationInCountry(locationStr?: string, countryQuery?: string): boolean {
  if (!countryQuery) return true;
  if (!locationStr) return false;

  const locLower = locationStr.toLowerCase();

  // Worldwide or Anywhere matches any abroad search
  if (
    locLower.includes("worldwide") ||
    locLower.includes("anywhere") ||
    locLower.includes("global") ||
    locLower.includes("everywhere")
  ) {
    return true;
  }

  const queryCode = normalizeCountryCode(countryQuery);

  // Avoid confusing California (US) with Canada
  if (queryCode === "CA") {
    const isUsStateCA = /,\s*ca(?:\s*\(hq\))?$/i.test(locLower) || locLower.includes("san francisco") || locLower.includes("los angeles");
    if (isUsStateCA && !locLower.includes("canada")) {
      return false;
    }
  }

  const aliases = COUNTRY_ALIASES[queryCode] || [countryQuery.toLowerCase().trim()];

  // Check if location string contains any of the country's aliases or cities
  return aliases.some((alias) => {
    // Word boundary or comma/space separation
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9])${escaped}(?:$|[^a-zA-Z0-9])`, "i");
    return regex.test(locLower);
  });
}

