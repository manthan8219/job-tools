import { BaseJobScraperAdapter } from "../baseAdapter.js";
import { ScrapeQuery, ScrapeResult, ScrapedJob } from "../types.js";
import { matchesTitle, matchesLocationFilter } from "../utils/matcherUtils.js";
import { logger } from "../../utils/index.js";

export interface FourDayJobItem {
  title: string;
  slug: string;
  company: {
    name: string;
  };
  locations?: Array<{ city?: string; country?: string }>;
  work_arrangement?: string;
  is_expired?: boolean;
}

export interface FourDayApiResponse {
  jobs: FourDayJobItem[];
  has_more?: boolean;
}

export class FourDayWeekJobScraperAdapter extends BaseJobScraperAdapter {
  readonly name = "FourDayWeekJobScraperAdapter";
  readonly source = "fourday";

  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options?: { baseUrl?: string; timeoutMs?: number }) {
    super();
    this.baseUrl = options?.baseUrl ?? "https://4dayweek.io/api/jobs";
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
          logger.warn(`[${this.name}] 4DayWeek API responded with HTTP ${response.status}`);
          break;
        }

        const data = (await response.json()) as FourDayApiResponse;
        pagesFetched++;
        hasMore = Boolean(data.has_more);
        const rawJobs = data.jobs || [];

        for (const item of rawJobs) {
          if (item.is_expired) continue;
          const title = item.title;
          const company = item.company?.name || "4DayWeek";
          if (!title || !item.slug) continue;

          if (!matchesTitle(title, query.query, query.titles) && !matchesTitle(company, query.query, query.titles)) {
            continue;
          }

          const locArr: string[] = [];
          if (item.locations) {
            for (const loc of item.locations) {
              const parts = [loc.city, loc.country].filter(Boolean);
              if (parts.length > 0) locArr.push(parts.join(", "));
            }
          }
          const locationStr = locArr.join(" / ");
          const isRemote =
            (item.work_arrangement && item.work_arrangement.toLowerCase().includes("remote")) ||
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

          matchedJobs.push({
            id: `fourday-${item.slug}`,
            title,
            company,
            location: locationStr || (isRemote ? "Remote" : "On-site"),
            url: `https://4dayweek.io/job/${item.slug}`,
            source: this.source,
            employmentType: "full-time",
            workArrangement: isRemote ? "remote" : "hybrid",
            categories: ["4-day week"],
            scrapedAt: new Date(),
            rawData: item as unknown as Record<string, unknown>,
          });
        }

        if (!hasMore || rawJobs.length === 0) {
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
