import { BaseJobScraperAdapter } from "../baseAdapter.js";
import { ScrapeQuery, ScrapeResult, ScrapedJob } from "../types.js";
import { matchesTitle, matchesLocationFilter } from "../utils/matcherUtils.js";
import { logger } from "../../utils/index.js";

export interface TheMuseJobItem {
  id?: number | string;
  name: string;
  refs: {
    landing_page: string;
  };
  company: {
    name: string;
    id?: number;
    short_name?: string;
  };
  locations: Array<{ name: string }>;
  categories?: Array<{ name: string }>;
  levels?: Array<{ name: string; short_name: string }>;
  contents?: string;
  publication_date?: string;
}

export interface TheMuseApiResponse {
  page: number;
  page_count: number;
  total: number;
  results: TheMuseJobItem[];
}

export class TheMuseJobScraperAdapter extends BaseJobScraperAdapter {
  readonly name = "TheMuseJobScraperAdapter";
  readonly source = "themuse";

  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options?: { baseUrl?: string; timeoutMs?: number }) {
    super();
    this.baseUrl = options?.baseUrl ?? "https://www.themuse.com/api/public/jobs";
    this.timeoutMs = options?.timeoutMs ?? 15000;
  }

  isConfigured(): boolean {
    return true;
  }

  protected async executeScrape(query: ScrapeQuery): Promise<ScrapeResult> {
    const matchedJobs: ScrapedJob[] = [];
    const maxPages = query.maxPages ?? 1;
    const startPage = query.page ?? 1;
    let totalFound = 0;
    let pagesFetched = 0;
    let hasMore = false;

    for (let page = startPage; page < startPage + maxPages; page++) {
      const url = `${this.baseUrl}?page=${page}`;
      logger.info(`[${this.name}] Requesting URL: ${url}`);

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
          logger.warn(`[${this.name}] The Muse API responded with HTTP ${response.status}`);
          break;
        }

        const data = (await response.json()) as TheMuseApiResponse;
        pagesFetched++;
        totalFound = data.total ?? 0;
        hasMore = page < data.page_count;

        const results = data.results || [];
        for (const item of results) {
          const title = item.name;
          const company = item.company?.name || "The Muse";
          const landingPage = item.refs?.landing_page;
          if (!title || !landingPage) continue;

          if (!matchesTitle(title, query.query, query.titles) && !matchesTitle(company, query.query, query.titles)) {
            continue;
          }

          const locationNames = (item.locations || []).map((l) => l.name);
          const locationStr = locationNames.join(", ");
          const isRemote = locationNames.some((l) => l.toLowerCase().includes("remote") || l.toLowerCase().includes("flexible"));

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

          const categories = (item.categories || []).map((c) => c.name);
          const postedAt = item.publication_date ? new Date(item.publication_date) : undefined;
          const id = item.id ? String(item.id) : encodeURIComponent(landingPage);

          matchedJobs.push({
            id: `themuse-${id}`,
            title,
            company,
            location: locationStr || (isRemote ? "Remote" : "On-site"),
            description: item.contents,
            url: landingPage,
            source: this.source,
            employmentType: "full-time",
            workArrangement: isRemote ? "remote" : "on-site",
            categories,
            postedAt,
            scrapedAt: new Date(),
            rawData: item as unknown as Record<string, unknown>,
          });
        }

        if (!hasMore || results.length === 0) {
          break;
        }
      } catch (err: any) {
        logger.error(`[${this.name}] Error fetching page ${page}: ${err.message}`);
        break;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    const limit = query.limit ?? 20;
    const paginatedJobs = matchedJobs.slice(0, limit);

    return {
      source: this.source,
      jobs: paginatedJobs,
      totalFound: matchedJobs.length,
      hasMore: matchedJobs.length > limit || hasMore,
      pagesFetched,
      fetchedAt: new Date(),
    };
  }
}
