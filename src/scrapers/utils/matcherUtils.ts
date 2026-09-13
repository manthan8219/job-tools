import { isLocationInCountry } from "./countryUtils.js";

/**
 * Checks if a job title or description matches the query or title keywords.
 */
export function matchesTitle(
  title: string,
  query?: string,
  targetTitles?: string[]
): boolean {
  if (!query && (!targetTitles || targetTitles.length === 0)) {
    return true;
  }

  const lowerTitle = title.toLowerCase();

  // If specific targetTitles are given
  if (targetTitles && targetTitles.length > 0) {
    const matched = targetTitles.some((target) => {
      const cleanTarget = target.toLowerCase().trim();
      if (!cleanTarget) return true;
      const words = cleanTarget.split(/\s+/).filter(Boolean);
      return words.every((w) => lowerTitle.includes(w));
    });
    if (matched) return true;
  }

  // If general query string is given
  if (query) {
    const cleanQuery = query.toLowerCase().trim();
    if (!cleanQuery) return true;
    const words = cleanQuery.split(/\s+/).filter(Boolean);
    return words.every((w) => lowerTitle.includes(w));
  }

  return false;
}

/**
 * Checks whether a job matches location, country, and remote constraints.
 */
export function matchesLocationFilter(options: {
  location?: string;
  isRemote?: boolean;
  country?: string;
  worldwideOnly?: boolean;
}): boolean {
  const { location = "", isRemote = false, country, worldwideOnly } = options;
  const locLower = location.toLowerCase();

  const effectiveRemote =
    isRemote ||
    locLower.includes("remote") ||
    locLower.includes("anywhere") ||
    locLower.includes("worldwide") ||
    locLower.includes("work from anywhere");

  if (worldwideOnly && !effectiveRemote) {
    return false;
  }

  if (country && !isLocationInCountry(location, country)) {
    // If it's globally remote, it matches any country
    if (!effectiveRemote) {
      return false;
    }
  }

  return true;
}

/**
 * Parses salary ranges from strings like "$120,000 - $160,000" or "€60k - €80k"
 */
export function extractSalary(text?: string): {
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
} {
  if (!text) return {};

  const clean = text.replace(/,/g, "");
  const match = clean.match(/([$€£₹])\s*(\d+(?:\.\d+)?)\s*(k|k\b)?\s*(?:-|to)\s*([$€£₹])?\s*(\d+(?:\.\d+)?)\s*(k|k\b)?/i);

  if (match) {
    const symbol = match[1];
    let min = parseFloat(match[2]);
    let max = parseFloat(match[5]);

    if (match[3]?.toLowerCase() === "k") min *= 1000;
    if (match[6]?.toLowerCase() === "k") max *= 1000;

    let currency = "USD";
    if (symbol === "€") currency = "EUR";
    else if (symbol === "£") currency = "GBP";
    else if (symbol === "₹") currency = "INR";

    return { salaryMin: min, salaryMax: max, salaryCurrency: currency };
  }

  return {};
}
