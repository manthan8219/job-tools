import { BaseJobScraperAdapter } from "../baseAdapter.js";
import { ScrapeQuery, ScrapeResult, ScrapedJob } from "../types.js";
import { DEFAULT_WORKABLE_COMPANIES, NamedSlugCompany } from "../data/companies.js";
import { runWithConcurrencySettled } from "../utils/concurrencyUtils.js";
import { matchesTitle, matchesLocationFilter } from "../utils/matcherUtils.js";
import { logger } from "../../utils/index.js";

export interface WorkableJobItem {
  id: string;
  title: string;
  shortcode: string;
  url?: string;
  department?: string;
  location?: {
    country?: string;
    city?: string;
    remote?: boolean;
  };
  employment_type?: string;
  published?: string;
}

export interface WorkableApiResponse {
  results: WorkableJobItem[];
}

export class WorkableJobScraperAdapter extends BaseJobScraperAdapter {
  readonly name = "WorkableJobScraperAdapter";
  readonly source = "workable";

  private readonly companies: NamedSlugCompany[];
  private readonly timeoutMs: number;
  private readonly concurrency: number;

  constructor(options?: { companies?: NamedSlugCompany[]; timeoutMs?: number; concurrency?: number }) {
    super();
    this.companies = options?.companies ?? DEFAULT_WORKABLE_COMPANIES;
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
        const url = `https://apply.workable.com/api/v3/accounts/${company.slug}/jobs?status=published&limit=50`;
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

          const data = (await response.json()) as WorkableApiResponse;
          const jobs = data.results || [];

          for (const item of jobs) {
            const title = item.title;
            if (!title || !item.shortcode) continue;

            if (!matchesTitle(title, query.query, query.titles) && !matchesTitle(company.name, query.query, query.titles)) {
              continue;
            }

            const locParts = [item.location?.city, item.location?.country].filter(Boolean);
            const locationStr = locParts.join(", ");
            const isRemote = Boolean(item.location?.remote) || locationStr.toLowerCase().includes("remote");

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

            const applyUrl = item.url || `https://apply.workable.com/${company.slug}/j/${item.shortcode}/`;
            const postedAt = item.published ? new Date(item.published) : undefined;
            const categories = item.department ? [item.department] : [];

            allJobs.push({
              id: `workable-${item.id || item.shortcode}`,
              title,
              company: company.name,
              location: locationStr || (isRemote ? "Remote" : "On-site"),
              url: applyUrl,
              source: this.source,
              employmentType: item.employment_type?.toLowerCase().includes("part") ? "part-time" : "full-time",
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
