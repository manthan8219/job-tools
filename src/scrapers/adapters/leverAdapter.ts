import { BaseJobScraperAdapter } from "../baseAdapter.js";
import { ScrapeQuery, ScrapeResult, ScrapedJob } from "../types.js";
import { DEFAULT_LEVER_COMPANIES, NamedSlugCompany } from "../data/companies.js";
import { runWithConcurrencySettled } from "../utils/concurrencyUtils.js";
import { isLocationInCountry } from "../utils/countryUtils.js";
import { matchesTitle } from "../utils/matcherUtils.js";
import { logger } from "../../utils/index.js";

export interface LeverJobItem {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl?: string;
  workplaceType?: "remote" | "hybrid" | "on-site" | "unspecified" | string;
  categories?: {
    commitment?: string;
    location?: string;
    team?: string;
    department?: string;
    allLocations?: string[];
  };
  description?: string;
  descriptionPlain?: string;
  createdAt?: number;
}

export class LeverJobScraperAdapter extends BaseJobScraperAdapter {
  readonly name = "LeverJobScraperAdapter";
  readonly source = "lever";

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
      this.companies = DEFAULT_LEVER_COMPANIES;
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
        const url = `https://api.lever.co/v0/postings/${company.slug}?mode=json`;
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

          const rawJobs = (await response.json()) as LeverJobItem[];
          if (!Array.isArray(rawJobs)) return;

          for (const item of rawJobs) {
            if (!matchesTitle(item.text, query.query, query.titles) && !matchesTitle(company.name, query.query, query.titles)) {
              const teamMatch = item.categories?.team && matchesTitle(item.categories.team, query.query, query.titles);
              const deptMatch = item.categories?.department && matchesTitle(item.categories.department, query.query, query.titles);
              const descMatch = item.descriptionPlain && matchesTitle(item.descriptionPlain, query.query, query.titles);
              if (!teamMatch && !deptMatch && !descMatch) {
                continue;
              }
            }

            const isRemote =
              item.workplaceType === "remote" ||
              item.text.toLowerCase().includes("remote") ||
              (item.categories?.location && item.categories.location.toLowerCase().includes("remote"));

            if (query.worldwideOnly && !isRemote) {
              continue;
            }

            // Abroad / country filtering
            const location = item.categories?.location || "";
            if (query.country && !isLocationInCountry(location, query.country)) {
              continue;
            }

            allJobs.push(this.mapToScrapedJob(item, company.name));
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

  private mapToScrapedJob(item: LeverJobItem, company: string): ScrapedJob {
    let workArrangement: ScrapedJob["workArrangement"] = "unknown";
    if (item.workplaceType === "remote") workArrangement = "remote";
    else if (item.workplaceType === "hybrid") workArrangement = "hybrid";
    else if (item.workplaceType === "on-site") workArrangement = "on-site";
    else if (item.text.toLowerCase().includes("remote")) workArrangement = "remote";

    let employmentType: ScrapedJob["employmentType"] = "unknown";
    if (item.categories?.commitment) {
      const c = item.categories.commitment.toLowerCase();
      if (c.includes("full")) employmentType = "full-time";
      else if (c.includes("part")) employmentType = "part-time";
      else if (c.includes("contract")) employmentType = "contract";
      else if (c.includes("intern")) employmentType = "internship";
    }

    const categories: string[] = [];
    if (item.categories?.team) categories.push(item.categories.team);
    if (item.categories?.department) categories.push(item.categories.department);

    return {
      id: `lever-${item.id}`,
      title: item.text,
      company,
      location: item.categories?.location || (workArrangement === "remote" ? "Remote" : "On-site"),
      description: item.description || item.descriptionPlain,
      url: item.hostedUrl,
      source: this.source,
      employmentType,
      workArrangement,
      categories,
      postedAt: item.createdAt ? new Date(item.createdAt) : undefined,
      scrapedAt: new Date(),
      rawData: item as unknown as Record<string, unknown>,
    };
  }
}
