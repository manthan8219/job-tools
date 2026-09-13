import { BaseJobScraperAdapter } from "../baseAdapter.js";
import { ScrapeQuery, ScrapeResult, ScrapedJob } from "../types.js";
import { DEFAULT_ASHBY_COMPANIES, NamedSlugCompany } from "../data/companies.js";
import { runWithConcurrencySettled } from "../utils/concurrencyUtils.js";
import { isLocationInCountry } from "../utils/countryUtils.js";
import { matchesTitle } from "../utils/matcherUtils.js";
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

  private readonly companies: NamedSlugCompany[];
  private readonly timeoutMs: number;
  private readonly concurrency: number;

  constructor(options?: { defaultCompanies?: Array<string | NamedSlugCompany>; timeoutMs?: number; concurrency?: number }) {
    super();
    if (options?.defaultCompanies) {
      this.companies = options.defaultCompanies.map((c) =>
        typeof c === "string" ? { name: c, slug: c } : c
      );
    } else {
      this.companies = DEFAULT_ASHBY_COMPANIES;
    }
    this.timeoutMs = options?.timeoutMs ?? 15000;
    this.concurrency = options?.concurrency ?? 5;
  }

  isConfigured(): boolean {
    return true;
  }

  protected async executeScrape(query: ScrapeQuery): Promise<ScrapeResult> {
    const allJobs: ScrapedJob[] = [];

    await runWithConcurrencySettled(
      this.companies,
      async (company) => {
        const url = `https://api.ashbyhq.com/posting-api/job-board/${company.slug}`;
        logger.info(`[${this.name}] Fetching board for company '${company.name}': ${url}`);

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
            logger.warn(`[${this.name}] Failed to fetch company '${company.name}' (HTTP ${response.status})`);
            return;
          }

          const data = (await response.json()) as AshbyBoardResponse;
          const rawJobs = data.jobs || [];

          for (const item of rawJobs) {
            if (!matchesTitle(item.title, query.query, query.titles) && !matchesTitle(company.name, query.query, query.titles)) {
              const teamMatch = item.team && matchesTitle(item.team, query.query, query.titles);
              const deptMatch = item.department && matchesTitle(item.department, query.query, query.titles);
              const descMatch = item.descriptionHtml && matchesTitle(item.descriptionHtml, query.query, query.titles);
              if (!teamMatch && !deptMatch && !descMatch) {
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

            allJobs.push(this.mapToScrapedJob(item, company.name, company.slug));
          }
        } catch (err: any) {
          logger.error(`[${this.name}] Error fetching company '${company.name}': ${err.message}`);
        } finally {
          clearTimeout(timeoutId);
        }
      },
      this.concurrency
    );

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

  private mapToScrapedJob(item: AshbyJobItem, companyName: string, companySlug: string): ScrapedJob {
    const { minSalary, maxSalary, currency } = this.parseCompensation(item.compensationTierSummary);

    const categories: string[] = [];
    if (item.team) categories.push(item.team);
    if (item.department) categories.push(item.department);

    return {
      id: `ashby-${item.id}`,
      title: item.title,
      company: companyName,
      location: item.location || (item.isRemote ? "Remote" : "On-site"),
      description: item.descriptionHtml,
      url: item.applyUrl || item.jobUrl || `https://jobs.ashbyhq.com/${companySlug}/${item.id}`,
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
