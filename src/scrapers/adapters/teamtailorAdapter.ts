import { BaseJobScraperAdapter } from "../baseAdapter.js";
import { ScrapeQuery, ScrapeResult, ScrapedJob } from "../types.js";
import { DEFAULT_TEAMTAILOR_COMPANIES, NamedSlugCompany } from "../data/companies.js";
import { runWithConcurrencySettled } from "../utils/concurrencyUtils.js";
import { parseRssFeed } from "../utils/xmlUtils.js";
import { matchesTitle, matchesLocationFilter } from "../utils/matcherUtils.js";
import { logger } from "../../utils/index.js";

export class TeamtailorJobScraperAdapter extends BaseJobScraperAdapter {
  readonly name = "TeamtailorJobScraperAdapter";
  readonly source = "teamtailor";

  private readonly companies: NamedSlugCompany[];
  private readonly timeoutMs: number;
  private readonly concurrency: number;

  constructor(options?: { companies?: NamedSlugCompany[]; timeoutMs?: number; concurrency?: number }) {
    super();
    this.companies = options?.companies ?? DEFAULT_TEAMTAILOR_COMPANIES;
    this.timeoutMs = options?.timeoutMs ?? 15000;
    this.concurrency = options?.concurrency ?? 5;
  }

  isConfigured(): boolean {
    return true;
  }

  protected async executeScrape(query: ScrapeQuery): Promise<ScrapeResult> {
    const allJobs: ScrapedJob[] = [];

    await runWithConcurrencySettled(
      this.companies,
      async (company) => {
        const url = `https://${company.slug}.teamtailor.com/jobs.rss`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
          const response = await fetch(url, {
            method: "GET",
            headers: {
              "Accept": "application/rss+xml, application/xml, text/xml",
              "User-Agent": "JobTools-Scraper/1.0",
            },
            signal: controller.signal,
          });

          if (!response.ok) {
            return;
          }

          const rawXml = await response.text();
          const items = parseRssFeed(rawXml);

          for (const item of items) {
            const title = String(item.title || "").trim();
            const applyUrl = String(item.link || "").trim();
            if (!title || !applyUrl) continue;

            if (!matchesTitle(title, query.query, query.titles) && !matchesTitle(company.name, query.query, query.titles)) {
              continue;
            }

            const desc = String(item.description || "");
            const isRemote =
              title.toLowerCase().includes("remote") ||
              desc.toLowerCase().includes("remote");

            if (
              !matchesLocationFilter({
                location: isRemote ? "Remote" : "",
                isRemote,
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
            const guid = typeof item.guid === "string" ? item.guid : item.guid?.["#text"] || applyUrl;

            allJobs.push({
              id: `teamtailor-${company.slug}-${encodeURIComponent(guid)}`,
              title,
              company: company.name,
              location: isRemote ? "Remote" : "On-site",
              description: desc,
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
        } catch (err: any) {
          logger.error(`[${this.name}] Error fetching ${company.name}: ${err.message}`);
        } finally {
          clearTimeout(timeoutId);
        }
      },
      this.concurrency
    );

    const limit = query.limit ?? 20;
    const paginatedJobs = allJobs.slice(0, limit);

    return {
      source: this.source,
      jobs: paginatedJobs,
      totalFound: allJobs.length,
      hasMore: allJobs.length > limit,
      pagesFetched: 1,
      fetchedAt: new Date(),
    };
  }
}
