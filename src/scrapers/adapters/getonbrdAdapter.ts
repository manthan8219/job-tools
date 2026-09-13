import { BaseJobScraperAdapter } from "../baseAdapter.js";
import { ScrapeQuery, ScrapeResult, ScrapedJob } from "../types.js";
import { matchesTitle, matchesLocationFilter } from "../utils/matcherUtils.js";
import { logger } from "../../utils/index.js";

export interface GetOnBrdJobItem {
  id?: string;
  attributes: {
    title: string;
    description?: string;
    remote: boolean;
    countries?: string[];
    company_name?: string;
    company?: {
      data?: {
        attributes?: {
          name?: string;
        };
      };
    };
    category_name?: string;
    published_at?: number;
  };
  links: {
    public_url: string;
  };
}

export interface GetOnBrdApiResponse {
  data: GetOnBrdJobItem[];
}

export class GetOnBrdJobScraperAdapter extends BaseJobScraperAdapter {
  readonly name = "GetOnBrdJobScraperAdapter";
  readonly source = "getonbrd";

  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options?: { baseUrl?: string; timeoutMs?: number }) {
    super();
    this.baseUrl = options?.baseUrl ?? "https://www.getonbrd.com/api/v0/categories/programming/jobs";
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
      const url = `${this.baseUrl}?expand[]=company&page=${page}&per_page=100`;
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
          logger.warn(`[${this.name}] GetOnBrd API responded with HTTP ${response.status}`);
          break;
        }

        const data = (await response.json()) as GetOnBrdApiResponse;
        pagesFetched++;
        const rawJobs = data.data || [];

        for (const item of rawJobs) {
          const attr = item.attributes;
          const title = attr?.title;
          const applyUrl = item.links?.public_url;
          if (!title || !applyUrl) continue;

          const company =
            attr.company?.data?.attributes?.name ||
            attr.company_name ||
            "Get on Board";

          if (!matchesTitle(title, query.query, query.titles) && !matchesTitle(company, query.query, query.titles)) {
            continue;
          }

          const locationStr = (attr.countries || []).join(", ");
          const isRemote = attr.remote;

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

          const categories: string[] = [];
          if (attr.category_name) categories.push(attr.category_name);

          const postedAt = attr.published_at ? new Date(attr.published_at * 1000) : undefined;
          const id = item.id || encodeURIComponent(applyUrl);

          matchedJobs.push({
            id: `getonbrd-${id}`,
            title,
            company,
            location: locationStr || (isRemote ? "Remote" : "On-site"),
            description: attr.description,
            url: applyUrl,
            source: this.source,
            employmentType: "full-time",
            workArrangement: isRemote ? "remote" : "on-site",
            categories,
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
