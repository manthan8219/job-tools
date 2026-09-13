import { BaseJobScraperAdapter } from "../baseAdapter.js";
import {
  ScrapeQuery,
  ScrapeResult,
  ScrapedJob,
  HimalayasJob,
  HimalayasJobsResponse,
  HimalayasJobsResponseSchema,
} from "../types.js";
import { logger } from "../../utils/index.js";

export interface HimalayasAdapterOptions {
  baseUrl?: string;
  timeoutMs?: number;
}

interface SinglePageResult {
  jobs: ScrapedJob[];
  totalCount: number;
  nextCursor?: string;
  nextPage?: number;
  currentPage?: number;
  totalPages?: number;
  hasMore: boolean;
}

export class HimalayasJobScraperAdapter extends BaseJobScraperAdapter {
  readonly name = "HimalayasJobScraperAdapter";
  readonly source = "himalayas";

  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options?: HimalayasAdapterOptions) {
    super();
    this.baseUrl = options?.baseUrl ?? "https://himalayas.app";
    this.timeoutMs = options?.timeoutMs ?? 15000;
  }

  isConfigured(): boolean {
    return true;
  }

  /**
   * Main scrape execution. Supports single page fetch or multi-page auto-pagination
   * controlled by query.maxPages (default 1).
   */
  protected async executeScrape(query: ScrapeQuery): Promise<ScrapeResult> {
    const maxPages = query.maxPages ?? 1;
    const delayMs = query.delayMs ?? 500;

    const allJobs: ScrapedJob[] = [];
    let currentCursor = query.cursor;
    let currentPage = query.page ?? 1;
    let totalFound = 0;
    let totalPages: number | undefined;
    let lastHasMore = false;
    let lastNextCursor: string | undefined;
    let lastNextPage: number | undefined;
    let pagesFetched = 0;

    for (let p = 0; p < maxPages; p++) {
      pagesFetched++;
      const pageResult = await this.fetchSinglePage(query, currentCursor, currentPage);

      allJobs.push(...pageResult.jobs);
      totalFound = pageResult.totalCount;
      totalPages = pageResult.totalPages;
      lastHasMore = pageResult.hasMore;
      lastNextCursor = pageResult.nextCursor;
      lastNextPage = pageResult.nextPage;

      // Update pointers for the next iteration
      currentCursor = pageResult.nextCursor;
      currentPage = pageResult.nextPage ?? (currentPage + 1);

      // If no more pages exist, terminate early
      if (!pageResult.hasMore) {
        break;
      }

      // If more iterations remain, delay politely to avoid rate limits
      if (p + 1 < maxPages && delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return {
      source: this.source,
      jobs: allJobs,
      totalFound,
      nextCursor: lastNextCursor,
      nextPage: lastNextPage,
      currentPage,
      totalPages,
      pagesFetched,
      hasMore: lastHasMore,
      fetchedAt: new Date(),
    };
  }

  /**
   * Async generator for streaming pages on-demand
   */
  async *paginate(query: ScrapeQuery): AsyncGenerator<SinglePageResult, void, unknown> {
    let currentCursor = query.cursor;
    let currentPage = query.page ?? 1;
    const delayMs = query.delayMs ?? 500;

    while (true) {
      const pageResult = await this.fetchSinglePage(query, currentCursor, currentPage);
      yield pageResult;

      if (!pageResult.hasMore) {
        break;
      }

      currentCursor = pageResult.nextCursor;
      currentPage = pageResult.nextPage ?? (currentPage + 1);

      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  /**
   * Fetches a single page from either the browse or search endpoint
   */
  private async fetchSinglePage(
    query: ScrapeQuery,
    cursor?: string,
    page?: number
  ): Promise<SinglePageResult> {
    const isSearchQuery = Boolean(
      query.query ||
      (query.titles && query.titles.length > 0) ||
      query.country ||
      query.worldwideOnly ||
      query.seniority?.length ||
      query.employmentType?.length
    );

    const url = isSearchQuery
      ? this.buildSearchUrl(query, page)
      : this.buildBrowseUrl(query, cursor);

    logger.info(`[${this.name}] Requesting URL: ${url.toString()}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "User-Agent": "JobTools-Scraper/1.0",
        },
        signal: controller.signal,
      });

      if (response.status === 429) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`Rate limit exceeded by Himalayas API (429): ${errorText}. Please wait before retrying.`);
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`Himalayas API responded with HTTP ${response.status}: ${errorText}`);
      }

      const rawJson = await response.json();
      const parseResult = HimalayasJobsResponseSchema.safeParse(rawJson);

      if (!parseResult.success) {
        logger.warn(`[${this.name}] Response schema warning: ${parseResult.error.message}`);
      }

      const data: HimalayasJobsResponse = (parseResult.success ? parseResult.data : rawJson) as HimalayasJobsResponse;
      const scrapedJobs: ScrapedJob[] = (data.jobs || []).map((job) => this.mapToScrapedJob(job));

      if (isSearchQuery) {
        // Search endpoint pagination: page-based (1-based index)
        const activePage = page ?? query.page ?? 1;
        const pageSize = data.limit || 20;
        const totalPages = Math.ceil(data.totalCount / pageSize);
        const hasMore = activePage < totalPages;
        const nextPage = hasMore ? activePage + 1 : undefined;

        return {
          jobs: scrapedJobs,
          totalCount: data.totalCount,
          currentPage: activePage,
          totalPages,
          nextPage,
          hasMore,
        };
      } else {
        // Browse endpoint pagination: cursor-based
        const nextCursor = data.nextCursor;
        const hasMore = Boolean(nextCursor);

        return {
          jobs: scrapedJobs,
          totalCount: data.totalCount,
          nextCursor,
          hasMore,
        };
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private buildBrowseUrl(query: ScrapeQuery, cursor?: string): URL {
    const url = new URL("/jobs/api", this.baseUrl);
    const limit = Math.min(query.limit ?? 20, 20);
    url.searchParams.set("limit", limit.toString());

    const activeCursor = cursor ?? query.cursor;
    if (activeCursor) {
      url.searchParams.set("cursor", activeCursor);
    }

    return url;
  }

  private buildSearchUrl(query: ScrapeQuery, page?: number): URL {
    const url = new URL("/jobs/api/search", this.baseUrl);

    const searchTerms = query.query || query.titles?.join(" ");
    if (searchTerms) {
      url.searchParams.set("q", searchTerms);
    }

    if (query.country) {
      url.searchParams.set("country", query.country);
    }

    if (query.worldwideOnly) {
      url.searchParams.set("worldwide", "true");
    }

    if (query.seniority && query.seniority.length > 0) {
      url.searchParams.set("seniority", query.seniority.join(","));
    }

    if (query.employmentType && query.employmentType.length > 0) {
      url.searchParams.set("employment_type", query.employmentType.join(","));
    }

    const activePage = page ?? query.page ?? 1;
    if (activePage > 1) {
      url.searchParams.set("page", activePage.toString());
    }

    return url;
  }

  private mapToScrapedJob(job: HimalayasJob): ScrapedJob {
    let location = "Worldwide (Remote)";
    if (job.locationRestrictions && job.locationRestrictions.length > 0) {
      const locNames = job.locationRestrictions
        .map((l) => (typeof l === "string" ? l : l.name || l.alpha2 || l.slug))
        .filter(Boolean);
      if (locNames.length > 0) {
        location = locNames.join(", ");
      }
    }

    let employmentType: ScrapedJob["employmentType"] = "unknown";
    switch (job.employmentType) {
      case "Full Time":
        employmentType = "full-time";
        break;
      case "Part Time":
        employmentType = "part-time";
        break;
      case "Contractor":
        employmentType = "contract";
        break;
      case "Intern":
        employmentType = "internship";
        break;
      case "Temporary":
        employmentType = "temporary";
        break;
      default:
        employmentType = "unknown";
    }

    return {
      id: job.guid,
      title: job.title,
      company: job.companyName,
      location,
      description: job.description,
      excerpt: job.excerpt,
      url: job.applicationLink,
      source: this.source,
      employmentType,
      workArrangement: "remote",
      salaryMin: job.minSalary ?? undefined,
      salaryMax: job.maxSalary ?? undefined,
      salaryCurrency: job.currency || "USD",
      salaryPeriod: job.salaryPeriod ?? "annual",
      categories: job.categories ?? [],
      postedAt: job.pubDate ? new Date(job.pubDate) : undefined,
      expiresAt: job.expiryDate ? new Date(job.expiryDate) : undefined,
      scrapedAt: new Date(),
      rawData: job as unknown as Record<string, unknown>,
    };
  }
}
