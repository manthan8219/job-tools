import { BaseJobScraperAdapter } from "../baseAdapter.js";
import { ScrapeQuery, ScrapeResult, ScrapedJob } from "../types.js";
import { DEFAULT_BREEZY_COMPANIES, NamedSlugCompany } from "../data/companies.js";
import { runWithConcurrencySettled } from "../utils/concurrencyUtils.js";
import { matchesTitle, matchesLocationFilter } from "../utils/matcherUtils.js";
import { logger } from "../../utils/index.js";

export interface BreezyJobItem {
  id?: string;
  name: string;
  url: string;
  location?: {
    name?: string;
    is_remote?: boolean;
  };
  department?: string;
  type?: {
    name?: string;
  };
  published_date?: string;
}

export class BreezyJobScraperAdapter extends BaseJobScraperAdapter {
  readonly name = "BreezyJobScraperAdapter";
  readonly source = "breezy";

  private readonly companies: NamedSlugCompany[];
  private readonly timeoutMs: number;
  private readonly concurrency: number;

  constructor(options?: { companies?: NamedSlugCompany[]; timeoutMs?: number; concurrency?: number }) {
    super();
    this.companies = options?.companies ?? DEFAULT_BREEZY_COMPANIES;
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
        const url = `https://${company.slug}.breezy.hr/json`;
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
            return;
          }

          const jobs = (await response.json()) as BreezyJobItem[];
          if (!Array.isArray(jobs)) return;

          for (const item of jobs) {
            const title = item.name;
            if (!title || !item.url) continue;

            if (!matchesTitle(title, query.query, query.titles) && !matchesTitle(company.name, query.query, query.titles)) {
              continue;
            }

            const locationStr = item.location?.name || "";
            const isRemote = Boolean(item.location?.is_remote) || locationStr.toLowerCase().includes("remote");

            if (
              !matchesLocationFilter({
                location: locationStr,
                isRemote,
                country: query.country,
                worldwideOnly: query.worldwideOnly,
              })
            ) {
              continue;
            }

            const postedAt = item.published_date ? new Date(item.published_date) : undefined;
            const categories = item.department ? [item.department] : [];

            allJobs.push({
              id: `breezy-${encodeURIComponent(item.url)}`,
              title,
              company: company.name,
              location: locationStr || (isRemote ? "Remote" : "On-site"),
              url: item.url,
              source: this.source,
              employmentType: item.type?.name?.toLowerCase().includes("part") ? "part-time" : "full-time",
              workArrangement: isRemote ? "remote" : "on-site",
              categories,
              postedAt,
              scrapedAt: new Date(),
              rawData: item as unknown as Record<string, unknown>,
            });
          }
        } catch (err: any) {
          logger.error(`[${this.name}] Error fetching ${company.name}: ${err.message}`);
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
}
