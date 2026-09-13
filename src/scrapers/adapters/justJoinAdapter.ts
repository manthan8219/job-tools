import { BaseJobScraperAdapter } from "../baseAdapter.js";
import { ScrapeQuery, ScrapeResult, ScrapedJob } from "../types.js";
import { matchesTitle, matchesLocationFilter } from "../utils/matcherUtils.js";
import { logger } from "../../utils/index.js";

export interface JustJoinJobItem {
  slug: string;
  title: string;
  companyName: string;
  city: string;
  workplaceType: string; // "remote", "hybrid", "office"
  applyMethod?: string;
  applyUrl?: string;
  publishedAt?: string;
  skills?: Array<{ name: string }>;
  employmentTypes?: Array<{
    salary?: {
      from?: number;
      to?: number;
      currency?: string;
    };
  }>;
}

export interface JustJoinApiResponse {
  data: JustJoinJobItem[];
  meta?: {
    totalPages?: number;
    totalItems?: number;
  };
}

export class JustJoinJobScraperAdapter extends BaseJobScraperAdapter {
  readonly name = "JustJoinJobScraperAdapter";
  readonly source = "justjoin";

  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options?: { baseUrl?: string; timeoutMs?: number }) {
    super();
    this.baseUrl = options?.baseUrl ?? "https://justjoin.it/api/candidate-api/offers";
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
      const url = `${this.baseUrl}?page=${page}&perPage=100`;
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
          logger.warn(`[${this.name}] JustJoin API responded with HTTP ${response.status}`);
          break;
        }

        const data = (await response.json()) as JustJoinApiResponse;
        pagesFetched++;
        const rawOffers = data.data || [];
        hasMore = Boolean(data.meta?.totalPages && page < data.meta.totalPages);

        for (const item of rawOffers) {
          const title = item.title;
          const company = item.companyName || "JustJoin";
          if (!title || !item.slug) continue;

          if (!matchesTitle(title, query.query, query.titles) && !matchesTitle(company, query.query, query.titles)) {
            continue;
          }

          const isRemote = item.workplaceType === "remote" || item.workplaceType === "hybrid";

          if (
            !matchesLocationFilter({
              location: item.city,
              isRemote,
              country: query.country,
              worldwideOnly: query.worldwideOnly,
            })
          ) {
            continue;
          }

          const applyUrl =
            item.applyMethod?.toLowerCase() === "external" && item.applyUrl
              ? item.applyUrl
              : `https://justjoin.it/job-offer/${item.slug}`;

          const categories = (item.skills || []).map((s) => s.name);
          const firstSalary = item.employmentTypes?.[0]?.salary;

          matchedJobs.push({
            id: `justjoin-${item.slug}`,
            title,
            company,
            location: item.city || (isRemote ? "Remote" : "On-site"),
            url: applyUrl,
            source: this.source,
            employmentType: "full-time",
            workArrangement: item.workplaceType === "remote" ? "remote" : item.workplaceType === "hybrid" ? "hybrid" : "on-site",
            salaryMin: firstSalary?.from,
            salaryMax: firstSalary?.to,
            salaryCurrency: firstSalary?.currency?.toUpperCase() || "PLN",
            categories,
            postedAt: item.publishedAt ? new Date(item.publishedAt) : undefined,
            scrapedAt: new Date(),
            rawData: item as unknown as Record<string, unknown>,
          });
        }

        if (!hasMore || rawOffers.length < 100) {
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
