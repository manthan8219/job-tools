import { BaseJobScraperAdapter } from "../baseAdapter.js";
import { ScrapeQuery, ScrapeResult, ScrapedJob } from "../types.js";
import { matchesTitle, matchesLocationFilter } from "../utils/matcherUtils.js";
import { logger } from "../../utils/index.js";

export interface ArbeitnowJobItem {
  slug: string;
  company_name: string;
  title: string;
  description?: string;
  remote: boolean;
  url: string;
  tags?: string[];
  job_types?: string[];
  location?: string;
  created_at?: number;
}

export interface ArbeitnowApiResponse {
  data: ArbeitnowJobItem[];
  links?: {
    next?: string | null;
  };
  meta?: {
    current_page?: number;
    from?: number;
    to?: number;
    total?: number;
  };
}

export class ArbeitnowJobScraperAdapter extends BaseJobScraperAdapter {
  readonly name = "ArbeitnowJobScraperAdapter";
  readonly source = "arbeitnow";

  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options?: { baseUrl?: string; timeoutMs?: number }) {
    super();
    this.baseUrl = options?.baseUrl ?? "https://www.arbeitnow.com/api/job-board-api";
    this.timeoutMs = options?.timeoutMs ?? 15000;
  }

  isConfigured(): boolean {
    return true;
  }

  protected async executeScrape(query: ScrapeQuery): Promise<ScrapeResult> {
    const matchedJobs: ScrapedJob[] = [];
    const maxPages = query.maxPages ?? 1;
    const startPage = query.page ?? 1;
    let totalAvailable = 0;
    let hasMore = false;
    let pagesFetched = 0;

    for (let page = startPage; page < startPage + maxPages; page++) {
      const pageUrl = `${this.baseUrl}?page=${page}`;
      logger.info(`[${this.name}] Requesting URL: ${pageUrl}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(pageUrl, {
          method: "GET",
          headers: {
            "Accept": "application/json",
            "User-Agent": "JobTools-Scraper/1.0",
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          logger.warn(`[${this.name}] API responded with HTTP ${response.status}`);
          break;
        }

        const payload = (await response.json()) as ArbeitnowApiResponse;
        pagesFetched++;
        const rawJobs = payload.data || [];
        totalAvailable = payload.meta?.total ?? (rawJobs.length + (payload.links?.next ? 50 : 0));
        hasMore = Boolean(payload.links?.next);

        for (const item of rawJobs) {
          if (!matchesTitle(item.title, query.query, query.titles)) {
            // Also check tags and company
            const tagMatches = item.tags?.some((t) => matchesTitle(t, query.query, query.titles));
            const companyMatches = matchesTitle(item.company_name, query.query, query.titles);
            if (!tagMatches && !companyMatches) {
              continue;
            }
          }

          if (
            !matchesLocationFilter({
              location: item.location,
              isRemote: item.remote,
              country: query.country,
              worldwideOnly: query.worldwideOnly,
            })
          ) {
            continue;
          }

          matchedJobs.push(this.mapToScrapedJob(item));
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

  private mapToScrapedJob(item: ArbeitnowJobItem): ScrapedJob {
    let employmentType: "full-time" | "contract" | "part-time" | "internship" | "temporary" | "unknown" = "unknown";
    if (item.job_types && item.job_types.length > 0) {
      const typeStr = item.job_types.join(" ").toLowerCase();
      if (typeStr.includes("full")) employmentType = "full-time";
      else if (typeStr.includes("part")) employmentType = "part-time";
      else if (typeStr.includes("contract") || typeStr.includes("freelance")) employmentType = "contract";
      else if (typeStr.includes("intern")) employmentType = "internship";
    }

    return {
      id: `arbeitnow-${item.slug}`,
      title: item.title,
      company: item.company_name || "Unknown Company",
      location: item.location || (item.remote ? "Remote" : "On-site"),
      description: item.description,
      url: item.url,
      source: this.source,
      employmentType,
      workArrangement: item.remote ? "remote" : "on-site",
      categories: item.tags ?? [],
      postedAt: item.created_at ? new Date(item.created_at * 1000) : undefined,
      scrapedAt: new Date(),
      rawData: item as unknown as Record<string, unknown>,
    };
  }
}
