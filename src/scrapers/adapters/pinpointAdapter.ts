import { BaseJobScraperAdapter } from "../baseAdapter.js";
import { ScrapeQuery, ScrapeResult, ScrapedJob } from "../types.js";
import { DEFAULT_PINPOINT_COMPANIES, NamedSlugCompany } from "../data/companies.js";
import { runWithConcurrencySettled } from "../utils/concurrencyUtils.js";
import { matchesTitle, matchesLocationFilter } from "../utils/matcherUtils.js";
import { logger } from "../../utils/index.js";

export interface PinpointJobItem {
  id?: string | number;
  title: string;
  url?: string;
  path?: string;
  location?: {
    name?: string;
  };
  department?: {
    name?: string;
  };
  employment_type?: string;
  workplace_type?: string;
}

export interface PinpointApiResponse {
  data: PinpointJobItem[];
}

export class PinpointJobScraperAdapter extends BaseJobScraperAdapter {
  readonly name = "PinpointJobScraperAdapter";
  readonly source = "pinpoint";

  private readonly companies: NamedSlugCompany[];
  private readonly timeoutMs: number;
  private readonly concurrency: number;

  constructor(options?: { companies?: NamedSlugCompany[]; timeoutMs?: number; concurrency?: number }) {
    super();
    this.companies = options?.companies ?? DEFAULT_PINPOINT_COMPANIES;
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
        const url = `https://${company.slug}.pinpointhq.com/postings.json`;
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

          const data = (await response.json()) as PinpointApiResponse;
          const jobs = data.data || [];

          for (const item of jobs) {
            const title = item.title;
            if (!title) continue;

            if (!matchesTitle(title, query.query, query.titles) && !matchesTitle(company.name, query.query, query.titles)) {
              continue;
            }

            const locationStr = item.location?.name || "";
            const isRemote =
              item.workplace_type?.toLowerCase() === "remote" ||
              locationStr.toLowerCase().includes("remote") ||
              title.toLowerCase().includes("remote");

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

            const applyUrl = item.url || (item.path ? `https://${company.slug}.pinpointhq.com${item.path}` : `https://${company.slug}.pinpointhq.com/postings/${item.id}`);
            const categories = item.department?.name ? [item.department.name] : [];

            allJobs.push({
              id: `pinpoint-${company.slug}-${item.id || encodeURIComponent(applyUrl)}`,
              title,
              company: company.name,
              location: locationStr || (isRemote ? "Remote" : "On-site"),
              url: applyUrl,
              source: this.source,
              employmentType: item.employment_type?.toLowerCase().includes("part") ? "part-time" : "full-time",
              workArrangement: isRemote ? "remote" : item.workplace_type?.toLowerCase() === "hybrid" ? "hybrid" : "on-site",
              categories,
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
