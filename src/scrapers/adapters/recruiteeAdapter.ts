import { BaseJobScraperAdapter } from "../baseAdapter.js";
import { ScrapeQuery, ScrapeResult, ScrapedJob } from "../types.js";
import { DEFAULT_RECRUITEE_COMPANIES, NamedSlugCompany } from "../data/companies.js";
import { runWithConcurrencySettled } from "../utils/concurrencyUtils.js";
import { matchesTitle, matchesLocationFilter } from "../utils/matcherUtils.js";
import { logger } from "../../utils/index.js";

export interface RecruiteeOfferItem {
  id?: number | string;
  title: string;
  careers_url?: string;
  city?: string;
  country?: string;
  remote?: boolean;
  department?: string;
  min_hours?: number;
  max_hours?: number;
  published_at?: string;
}

export interface RecruiteeApiResponse {
  offers: RecruiteeOfferItem[];
}

export class RecruiteeJobScraperAdapter extends BaseJobScraperAdapter {
  readonly name = "RecruiteeJobScraperAdapter";
  readonly source = "recruitee";

  private readonly companies: NamedSlugCompany[];
  private readonly timeoutMs: number;
  private readonly concurrency: number;

  constructor(options?: { companies?: NamedSlugCompany[]; timeoutMs?: number; concurrency?: number }) {
    super();
    this.companies = options?.companies ?? DEFAULT_RECRUITEE_COMPANIES;
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
        const url = `https://${company.slug}.recruitee.com/api/offers/`;
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
            return;
          }

          const data = (await response.json()) as RecruiteeApiResponse;
          const offers = data.offers || [];

          for (const item of offers) {
            const title = item.title;
            const applyUrl = item.careers_url;
            if (!title || !applyUrl) continue;

            if (!matchesTitle(title, query.query, query.titles) && !matchesTitle(company.name, query.query, query.titles)) {
              continue;
            }

            const locParts = [item.city, item.country].filter(Boolean);
            const locationStr = locParts.join(", ");
            const isRemote = Boolean(item.remote) || locationStr.toLowerCase().includes("remote");

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

            const categories = item.department ? [item.department] : [];
            const postedAt = item.published_at ? new Date(item.published_at) : undefined;

            allJobs.push({
              id: `recruitee-${item.id || encodeURIComponent(applyUrl)}`,
              title,
              company: company.name,
              location: locationStr || (isRemote ? "Remote" : "On-site"),
              url: applyUrl,
              source: this.source,
              employmentType: item.max_hours && item.max_hours < 30 ? "part-time" : "full-time",
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
