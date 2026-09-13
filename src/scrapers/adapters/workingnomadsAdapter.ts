import { BaseJobScraperAdapter } from "../baseAdapter.js";
import { ScrapeQuery, ScrapeResult, ScrapedJob } from "../types.js";
import { matchesTitle, matchesLocationFilter } from "../utils/matcherUtils.js";
import { logger } from "../../utils/index.js";

export interface WorkingNomadsJobItem {
  id?: number | string;
  title: string;
  url: string;
  company_name: string;
  location?: string;
  category_name?: string;
  tags?: string;
  description?: string;
  pub_date?: string;
}

export class WorkingNomadsJobScraperAdapter extends BaseJobScraperAdapter {
  readonly name = "WorkingNomadsJobScraperAdapter";
  readonly source = "workingnomads";

  private readonly apiUrl: string;
  private readonly timeoutMs: number;

  constructor(options?: { apiUrl?: string; timeoutMs?: number }) {
    super();
    this.apiUrl = options?.apiUrl ?? "https://www.workingnomads.com/api/exposed_jobs/";
    this.timeoutMs = options?.timeoutMs ?? 15000;
  }

  isConfigured(): boolean {
    return true;
  }

  protected async executeScrape(query: ScrapeQuery): Promise<ScrapeResult> {
    logger.info(`[${this.name}] Requesting URL: ${this.apiUrl}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.apiUrl, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "User-Agent": "JobTools-Scraper/1.0",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`WorkingNomads API responded with HTTP ${response.status}`);
      }

      const rawItems = (await response.json()) as WorkingNomadsJobItem[];
      if (!Array.isArray(rawItems)) {
        return {
          source: this.source,
          jobs: [],
          totalFound: 0,
          hasMore: false,
          pagesFetched: 1,
          fetchedAt: new Date(),
        };
      }

      const matchedJobs: ScrapedJob[] = [];

      for (const item of rawItems) {
        const title = String(item.title || "").trim();
        const url = String(item.url || "").trim();
        if (!title || !url) continue;

        const company = item.company_name || "WorkingNomads";

        if (
          !matchesTitle(title, query.query, query.titles) &&
          !matchesTitle(company, query.query, query.titles) &&
          !matchesTitle(item.tags || "", query.query, query.titles)
        ) {
          continue;
        }

        if (
          !matchesLocationFilter({
            location: item.location || "Remote",
            isRemote: true,
            country: query.country,
            worldwideOnly: query.worldwideOnly,
          })
        ) {
          continue;
        }

        const categories = item.tags ? item.tags.split(",").map((t) => t.trim()) : [];
        if (item.category_name && !categories.includes(item.category_name)) {
          categories.push(item.category_name);
        }

        const postedAt = item.pub_date ? new Date(item.pub_date) : undefined;
        const id = item.id ? String(item.id) : encodeURIComponent(url);

        matchedJobs.push({
          id: `workingnomads-${id}`,
          title,
          company,
          location: item.location || "Worldwide (Remote)",
          description: item.description,
          url,
          source: this.source,
          employmentType: "full-time",
          workArrangement: "remote",
          categories,
          postedAt,
          scrapedAt: new Date(),
          rawData: item as unknown as Record<string, unknown>,
        });
      }

      const limit = query.limit ?? 20;
      const paginatedJobs = matchedJobs.slice(0, limit);

      return {
        source: this.source,
        jobs: paginatedJobs,
        totalFound: matchedJobs.length,
        hasMore: matchedJobs.length > limit,
        pagesFetched: 1,
        fetchedAt: new Date(),
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
