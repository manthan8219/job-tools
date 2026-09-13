import { BaseJobScraperAdapter } from "../baseAdapter.js";
import { ScrapeQuery, ScrapeResult, ScrapedJob } from "../types.js";
import { matchesTitle, matchesLocationFilter } from "../utils/matcherUtils.js";
import { logger } from "../../utils/index.js";

export interface WttjOffice {
  city?: string;
  country?: string;
}

export interface WttjHit {
  objectID: string;
  job_title: string;
  organization_name: string;
  remote?: string;
  offices?: WttjOffice[];
  published_at?: string;
  summary?: string;
}

export interface WttjSearchResponse {
  hits: WttjHit[];
  nbHits?: number;
  page?: number;
  nbPages?: number;
}

export class WttjJobScraperAdapter extends BaseJobScraperAdapter {
  readonly name = "WttjJobScraperAdapter";
  readonly source = "wttj";

  private readonly timeoutMs: number;

  constructor(options?: { timeoutMs?: number }) {
    super();
    this.timeoutMs = options?.timeoutMs ?? 15000;
  }

  isConfigured(): boolean {
    return true;
  }

  protected async executeScrape(query: ScrapeQuery): Promise<ScrapeResult> {
    logger.info(`[${this.name}] Fetching WTTJ environment configuration...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      // Step 1: get Algolia public credentials from WTTJ env endpoint
      const envRes = await fetch("https://www.welcometothejungle.com/api/env", {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "User-Agent": "JobTools-Scraper/1.0",
        },
        signal: controller.signal,
      });

      if (!envRes.ok) {
        throw new Error(`WTTJ env endpoint returned HTTP ${envRes.status}`);
      }

      const envData = (await envRes.json()) as {
        PUBLIC_ALGOLIA_APPLICATION_ID?: string;
        PUBLIC_ALGOLIA_API_KEY_CLIENT?: string;
      };

      const appId = envData.PUBLIC_ALGOLIA_APPLICATION_ID?.trim();
      const apiKey = envData.PUBLIC_ALGOLIA_API_KEY_CLIENT?.trim();

      if (!appId || !apiKey) {
        throw new Error("Missing public Algolia credentials from WTTJ env");
      }

      // Step 2: query Algolia index
      const algoliaUrl = `https://${appId}-dsn.algolia.net/1/indexes/wttj_jobs_production_en/query`;
      const searchTerm = query.query || query.titles?.join(" ") || "";

      const algoliaBody = {
        query: searchTerm,
        hitsPerPage: Math.min(query.limit ?? 20, 50),
        page: (query.page ?? 1) - 1,
      };

      const algRes = await fetch(algoliaUrl, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "X-Algolia-Application-Id": appId,
          "X-Algolia-API-Key": apiKey,
          "Referer": "https://www.welcometothejungle.com",
          "User-Agent": "JobTools-Scraper/1.0",
        },
        body: JSON.stringify(algoliaBody),
        signal: controller.signal,
      });

      if (!algRes.ok) {
        throw new Error(`Algolia query returned HTTP ${algRes.status}`);
      }

      const searchData = (await algRes.json()) as WttjSearchResponse;
      const rawHits = searchData.hits || [];
      const matchedJobs: ScrapedJob[] = [];

      for (const hit of rawHits) {
        const title = hit.job_title;
        const company = hit.organization_name || "Welcome to the Jungle";
        if (!title || !hit.objectID) continue;

        if (!matchesTitle(title, query.query, query.titles) && !matchesTitle(company, query.query, query.titles)) {
          continue;
        }

        const offices = (hit.offices || [])
          .map((o) => [o.city, o.country].filter(Boolean).join(", "))
          .filter(Boolean);
        const locationStr = offices.join(" / ");
        const isRemote = hit.remote === "fulltime" || hit.remote === "partial" || locationStr.toLowerCase().includes("remote");

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
          id: `wttj-${hit.objectID}`,
          title,
          company,
          location: locationStr || (isRemote ? "Remote" : "On-site"),
          description: hit.summary,
          url: `https://www.welcometothejungle.com/jobs/${hit.objectID}`,
          source: this.source,
          employmentType: "full-time",
          workArrangement: hit.remote === "fulltime" ? "remote" : hit.remote === "partial" ? "hybrid" : "on-site",
          postedAt: hit.published_at ? new Date(hit.published_at) : undefined,
          scrapedAt: new Date(),
          rawData: hit as unknown as Record<string, unknown>,
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
