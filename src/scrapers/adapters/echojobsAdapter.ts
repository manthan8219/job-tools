import { BaseJobScraperAdapter } from "../baseAdapter.js";
import { ScrapeQuery, ScrapeResult, ScrapedJob } from "../types.js";
import { matchesTitle, matchesLocationFilter } from "../utils/matcherUtils.js";
import { logger } from "../../utils/index.js";

export interface EchoJobItem {
  id?: string | number;
  title: string;
  url: string;
  company_name: string;
  locations?: string[];
  remote_type?: string;
  tags?: string[];
  created_at?: string;
}

export interface EchoJobsApiResponse {
  jobs: EchoJobItem[];
}

export class EchoJobsJobScraperAdapter extends BaseJobScraperAdapter {
  readonly name = "EchoJobsJobScraperAdapter";
  readonly source = "echojobs";

  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options?: { baseUrl?: string; timeoutMs?: number }) {
    super();
    this.baseUrl = options?.baseUrl ?? "https://echojobs.io/api/jobs";
    this.timeoutMs = options?.timeoutMs ?? 15000;
  }

  isConfigured(): boolean {
    return true;
  }

  protected async executeScrape(query: ScrapeQuery): Promise<ScrapeResult> {
    const matchedJobs: ScrapedJob[] = [];
    const maxPages = query.maxPages ?? 1;
    const startPage = query.page ?? 1;
    let pagesFetched = 0;

    for (let page = startPage; page < startPage + maxPages; page++) {
      const url = `${this.baseUrl}?page=${page}&per_page=100`;
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
          logger.warn(`[${this.name}] EchoJobs API responded with HTTP ${response.status}`);
          break;
        }

        const data = (await response.json()) as EchoJobsApiResponse;
        pagesFetched++;
        const rawJobs = data.jobs || [];

        for (const item of rawJobs) {
          const title = item.title;
          const applyUrl = item.url;
          if (!title || !applyUrl) continue;

          const company = item.company_name || "EchoJobs";

          if (!matchesTitle(title, query.query, query.titles) && !matchesTitle(company, query.query, query.titles)) {
            continue;
          }

          const locationStr = (item.locations || []).join(", ");
          const isRemote =
            item.remote_type === "fully_remote" ||
            item.remote_type === "hybrid" ||
            locationStr.toLowerCase().includes("remote");

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

          const postedAt = item.created_at ? new Date(item.created_at) : undefined;
          const id = item.id ? String(item.id) : encodeURIComponent(applyUrl);

          matchedJobs.push({
            id: `echojobs-${id}`,
            title,
            company,
            location: locationStr || (isRemote ? "Remote" : "On-site"),
            url: applyUrl,
            source: this.source,
            employmentType: "full-time",
            workArrangement: item.remote_type === "fully_remote" ? "remote" : item.remote_type === "hybrid" ? "hybrid" : "on-site",
            categories: item.tags ?? [],
            postedAt,
            scrapedAt: new Date(),
            rawData: item as unknown as Record<string, unknown>,
          });
        }

        if (rawJobs.length < 100) {
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
      hasMore: matchedJobs.length > limit,
      pagesFetched,
      fetchedAt: new Date(),
    };
  }
}
