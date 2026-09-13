import { BaseJobScraperAdapter } from "../baseAdapter.js";
import { ScrapeQuery, ScrapeResult, ScrapedJob } from "../types.js";
import { matchesTitle, matchesLocationFilter } from "../utils/matcherUtils.js";
import { logger } from "../../utils/index.js";

export interface NoFluffJobItem {
  id?: string;
  url: string;
  title: string;
  name: string; // company name
  location?: {
    places?: Array<{ city?: string; country?: string }>;
    fullyRemote?: boolean;
  };
  salary?: {
    from?: number;
    to?: number;
    currency?: string;
    type?: string;
  };
  posted?: number;
  tags?: Array<{ value?: string }>;
}

export interface NoFluffJobsApiResponse {
  postings: NoFluffJobItem[];
  totalCount?: number;
  totalPages?: number;
}

export class NoFluffJobsJobScraperAdapter extends BaseJobScraperAdapter {
  readonly name = "NoFluffJobsJobScraperAdapter";
  readonly source = "nofluffjobs";

  private readonly apiUrl: string;
  private readonly timeoutMs: number;

  constructor(options?: { apiUrl?: string; timeoutMs?: number }) {
    super();
    this.apiUrl = options?.apiUrl ?? "https://nofluffjobs.com/api/search/posting";
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
      logger.info(`[${this.name}] Requesting page ${page} from ${this.apiUrl}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const bodyPayload = {
          criteriaSearch: {
            requirement: query.query ? [query.query] : [],
            ...(query.worldwideOnly ? { remote: "remote" } : {}),
          },
          page,
          pageSize: 50,
        };

        const response = await fetch(this.apiUrl, {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "JobTools-Scraper/1.0",
          },
          body: JSON.stringify(bodyPayload),
          signal: controller.signal,
        });

        if (!response.ok) {
          logger.warn(`[${this.name}] API responded with HTTP ${response.status}`);
          break;
        }

        const data = (await response.json()) as NoFluffJobsApiResponse;
        pagesFetched++;
        const rawPostings = data.postings || [];

        for (const item of rawPostings) {
          const title = item.title;
          const company = item.name || "NoFluffJobs";
          if (!title || !item.url) continue;

          if (!matchesTitle(title, query.query, query.titles) && !matchesTitle(company, query.query, query.titles)) {
            continue;
          }

          const cities = (item.location?.places || []).map((p) => p.city).filter(Boolean);
          const locationStr = cities.join(", ");
          const isRemote = Boolean(item.location?.fullyRemote) || locationStr.toLowerCase().includes("remote");

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

          const fullUrl = item.url.startsWith("http") ? item.url : `https://nofluffjobs.com/job/${item.url.replace(/^\/+/, "")}`;
          const postedAt = item.posted ? new Date(item.posted) : undefined;
          const categories = (item.tags || []).map((t) => t.value).filter(Boolean) as string[];

          matchedJobs.push({
            id: `nofluffjobs-${encodeURIComponent(item.url)}`,
            title,
            company,
            location: locationStr || (isRemote ? "Remote" : "On-site"),
            url: fullUrl,
            source: this.source,
            employmentType: "full-time",
            workArrangement: isRemote ? "remote" : "on-site",
            salaryMin: item.salary?.from,
            salaryMax: item.salary?.to,
            salaryCurrency: item.salary?.currency || "USD",
            categories,
            postedAt,
            scrapedAt: new Date(),
            rawData: item as unknown as Record<string, unknown>,
          });
        }

        if (rawPostings.length < 50) {
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
