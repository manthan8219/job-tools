import { BaseJobScraperAdapter } from "../baseAdapter.js";
import { ScrapeQuery, ScrapeResult, ScrapedJob } from "../types.js";
import { parseRssFeed } from "../utils/xmlUtils.js";
import { matchesTitle, matchesLocationFilter } from "../utils/matcherUtils.js";
import { logger } from "../../utils/index.js";

export class WeWorkRemotelyJobScraperAdapter extends BaseJobScraperAdapter {
  readonly name = "WeWorkRemotelyJobScraperAdapter";
  readonly source = "weworkremotely";

  private readonly feedUrl: string;
  private readonly timeoutMs: number;

  constructor(options?: { feedUrl?: string; timeoutMs?: number }) {
    super();
    this.feedUrl = options?.feedUrl ?? "https://weworkremotely.com/remote-jobs.rss";
    this.timeoutMs = options?.timeoutMs ?? 15000;
  }

  isConfigured(): boolean {
    return true;
  }

  protected async executeScrape(query: ScrapeQuery): Promise<ScrapeResult> {
    logger.info(`[${this.name}] Requesting feed: ${this.feedUrl}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.feedUrl, {
        method: "GET",
        headers: {
          "Accept": "application/rss+xml, application/xml, text/xml",
          "User-Agent": "JobTools-Scraper/1.0",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`WeWorkRemotely RSS feed responded with HTTP ${response.status}`);
      }

      const xmlText = await response.text();
      const items = parseRssFeed(xmlText);

      const matchedJobs: ScrapedJob[] = [];

      for (const item of items) {
        const rawTitle = String(item.title || "").trim();
        const link = String(item.link || "").trim();
        if (!rawTitle || !link) continue;

        // WWR title format is commonly "Company: Job Title"
        let company = "WeWorkRemotely";
        let title = rawTitle;
        const colonIdx = rawTitle.indexOf(": ");
        if (colonIdx !== -1) {
          company = rawTitle.slice(0, colonIdx).trim();
          title = rawTitle.slice(colonIdx + 2).trim();
        }

        if (!matchesTitle(title, query.query, query.titles) && !matchesTitle(company, query.query, query.titles)) {
          continue;
        }

        if (
          !matchesLocationFilter({
            location: "Remote",
            isRemote: true,
            country: query.country,
            worldwideOnly: query.worldwideOnly,
          })
        ) {
          continue;
        }

        const categories: string[] = [];
        if (item.category) {
          if (Array.isArray(item.category)) categories.push(...item.category);
          else categories.push(String(item.category));
        }

        const postedAt = item.pubDate ? new Date(item.pubDate) : undefined;
        const guid = typeof item.guid === "string" ? item.guid : item.guid?.["#text"] || link;

        matchedJobs.push({
          id: `weworkremotely-${encodeURIComponent(guid)}`,
          title,
          company,
          location: "Worldwide (Remote)",
          description: item.description,
          url: link,
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
