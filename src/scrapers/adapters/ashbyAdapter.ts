import { BaseJobScraperAdapter } from "../baseAdapter.js";
import { ScrapeQuery, ScrapeResult, ScrapedJob } from "../types.js";
import { isLocationInCountry } from "../utils/countryUtils.js";
import { logger } from "../../utils/index.js";

export interface AshbyJobItem {
  id: string;
  title: string;
  location?: string;
  isRemote?: boolean;
  team?: string;
  department?: string;
  compensationTierSummary?: string;
  descriptionHtml?: string;
  applyUrl?: string;
  jobUrl?: string;
  publishedAt?: string;
}

export interface AshbyBoardResponse {
  jobs?: AshbyJobItem[];
}

export class AshbyJobScraperAdapter extends BaseJobScraperAdapter {
  readonly name = "AshbyJobScraperAdapter";
  readonly source = "ashby";

  private readonly companies: string[];
  private readonly timeoutMs: number;

  constructor(options?: { defaultCompanies?: string[]; timeoutMs?: number }) {
    super();
    this.companies = options?.defaultCompanies ?? [
      "ramp",
      "notion",
      "linear",
      "1password",
      "wealthsimple",
      "anysphere",
    ];
    this.timeoutMs = options?.timeoutMs ?? 15000;
  }

  isConfigured(): boolean {
    return true;
  }

  protected async executeScrape(query: ScrapeQuery): Promise<ScrapeResult> {
    const allJobs: ScrapedJob[] = [];
    const searchTerms = (query.query || query.titles?.join(" ") || "").toLowerCase();

    for (const company of this.companies) {
      const url = `https://api.ashbyhq.com/posting-api/job-board/${company}`;
      logger.info(`[${this.name}] Fetching board for company '${company}': ${url}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Accept": "application/json",
            "User-Agent": "JobTools-Scraper/1.0",
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          logger.warn(`[${this.name}] Failed to fetch company '${company}' (HTTP ${response.status})`);
          continue;
        }

        const data = (await response.json()) as AshbyBoardResponse;
        const rawJobs = data.jobs || [];

        for (const item of rawJobs) {
          if (searchTerms) {
            const searchWords = searchTerms.split(/\s+/).filter(Boolean);
            const matches = searchWords.every(
              (word) =>
                item.title.toLowerCase().includes(word) ||
                item.team?.toLowerCase().includes(word) ||
                item.department?.toLowerCase().includes(word) ||
                (item.descriptionHtml && item.descriptionHtml.toLowerCase().includes(word))
            );
            if (!matches) {
              continue;
            }
          }

          if (query.worldwideOnly && !item.isRemote) {
            continue;
          }

          // Abroad / country filtering
          if (query.country && !isLocationInCountry(item.location, query.country)) {
            continue;
          }

          allJobs.push(this.mapToScrapedJob(item, company));
        }
      } catch (err: any) {
        logger.error(`[${this.name}] Error fetching company '${company}': ${err.message}`);
      } finally {
        clearTimeout(timeoutId);
      }
    }

    const limit = query.limit ?? 20;
    const paginatedJobs = allJobs.slice(0, limit);

    return {
      source: this.source,
      jobs: paginatedJobs,
      totalFound: allJobs.length,
      hasMore: allJobs.length > limit,
      pagesFetched: 1,
      fetchedAt: new Date(),
    };
  }

  private mapToScrapedJob(item: AshbyJobItem, company: string): ScrapedJob {
    const { minSalary, maxSalary, currency } = this.parseCompensation(item.compensationTierSummary);

    const categories: string[] = [];
    if (item.team) categories.push(item.team);
    if (item.department) categories.push(item.department);

    return {
      id: `ashby-${item.id}`,
      title: item.title,
      company,
      location: item.location || (item.isRemote ? "Remote" : "On-site"),
      description: item.descriptionHtml,
      url: item.applyUrl || item.jobUrl || `https://jobs.ashbyhq.com/${company}/${item.id}`,
      source: this.source,
      employmentType: "full-time",
      workArrangement: item.isRemote ? "remote" : "on-site",
      salaryMin: minSalary,
      salaryMax: maxSalary,
      salaryCurrency: currency || "USD",
      salaryPeriod: "annual",
      categories,
      postedAt: item.publishedAt ? new Date(item.publishedAt) : undefined,
      scrapedAt: new Date(),
      rawData: item as unknown as Record<string, unknown>,
    };
  }

  private parseCompensation(tierSummary?: string): { minSalary?: number; maxSalary?: number; currency?: string } {
    if (!tierSummary) return {};

    // E.g. "$150,000 - $200,000 USD" or "£80,000 - £100,000"
    const currency = tierSummary.includes("USD") ? "USD" : tierSummary.includes("EUR") ? "EUR" : tierSummary.includes("GBP") ? "GBP" : "USD";
    const numRegex = /\$?(\d{2,3}(?:,\d{3})+)/g;
    const matches: number[] = [];
    let match;

    while ((match = numRegex.exec(tierSummary)) !== null) {
      matches.push(parseInt(match[1].replace(/,/g, ""), 10));
    }

    if (matches.length >= 2) {
      return { minSalary: matches[0], maxSalary: matches[1], currency };
    } else if (matches.length === 1) {
      return { minSalary: matches[0], currency };
    }

    return { currency };
  }
}
