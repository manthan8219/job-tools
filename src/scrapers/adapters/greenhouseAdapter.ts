import { BaseJobScraperAdapter } from "../baseAdapter.js";
import { ScrapeQuery, ScrapeResult, ScrapedJob } from "../types.js";
import { DEFAULT_GREENHOUSE_COMPANIES, NamedBoardCompany } from "../data/companies.js";
import { runWithConcurrencySettled } from "../utils/concurrencyUtils.js";
import { isLocationInCountry } from "../utils/countryUtils.js";
import { matchesTitle } from "../utils/matcherUtils.js";
import { logger } from "../../utils/index.js";

export interface GreenhouseJobItem {
  id: number;
  title: string;
  absolute_url: string;
  location?: {
    name?: string;
  };
  departments?: Array<{
    id: number;
    name: string;
  }>;
  offices?: Array<{
    id: number;
    name: string;
    location?: string;
  }>;
  content?: string;
  updated_at?: string;
}

export interface GreenhouseBoardResponse {
  jobs?: GreenhouseJobItem[];
}

export class GreenhouseJobScraperAdapter extends BaseJobScraperAdapter {
  readonly name = "GreenhouseJobScraperAdapter";
  readonly source = "greenhouse";

  private readonly companies: Array<{ name: string; board: string }>;
  private readonly timeoutMs: number;
  private readonly concurrency: number;

  constructor(options?: { defaultCompanies?: Array<string | NamedBoardCompany>; timeoutMs?: number; concurrency?: number }) {
    super();
    if (options?.defaultCompanies) {
      this.companies = options.defaultCompanies.map((c) =>
        typeof c === "string" ? { name: c, board: c } : c
      );
    } else {
      this.companies = DEFAULT_GREENHOUSE_COMPANIES;
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
        const url = `https://boards-api.greenhouse.io/v1/boards/${company.board}/jobs?content=true`;
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

          const data = (await response.json()) as GreenhouseBoardResponse;
          const rawJobs = data.jobs || [];

          for (const item of rawJobs) {
            if (!matchesTitle(item.title, query.query, query.titles) && !matchesTitle(company.name, query.query, query.titles)) {
              const departmentMatch = item.departments?.some((d) => matchesTitle(d.name, query.query, query.titles));
              const contentMatch = item.content && matchesTitle(item.content, query.query, query.titles);
              if (!departmentMatch && !contentMatch) {
                continue;
              }
            }

            const locationName = item.location?.name || "";
            const isRemote = locationName.toLowerCase().includes("remote") || item.title.toLowerCase().includes("remote");

            if (query.worldwideOnly && !isRemote) {
              continue;
            }

            // Abroad / country filtering
            if (query.country && !isLocationInCountry(locationName, query.country)) {
              continue;
            }

            allJobs.push(this.mapToScrapedJob(item, company.name, isRemote));
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

  private mapToScrapedJob(item: GreenhouseJobItem, company: string, isRemote: boolean): ScrapedJob {
    const categories: string[] = [];
    if (item.departments) {
      categories.push(...item.departments.map((d) => d.name));
    }

    // Decode escaped HTML if present
    const decodedContent = item.content
      ? item.content.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
      : undefined;

    return {
      id: `greenhouse-${item.id}`,
      title: item.title,
      company,
      location: item.location?.name || (isRemote ? "Remote" : "On-site"),
      description: decodedContent,
      url: item.absolute_url,
      source: this.source,
      employmentType: "full-time",
      workArrangement: isRemote ? "remote" : "on-site",
      categories,
      postedAt: item.updated_at ? new Date(item.updated_at) : undefined,
      scrapedAt: new Date(),
      rawData: item as unknown as Record<string, unknown>,
    };
  }
}
