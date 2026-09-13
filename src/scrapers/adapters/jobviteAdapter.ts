import { BaseJobScraperAdapter } from "../baseAdapter.js";
import { ScrapeQuery, ScrapeResult, ScrapedJob } from "../types.js";
import { DEFAULT_JOBVITE_COMPANIES, NamedSlugCompany } from "../data/companies.js";
import { runWithConcurrencySettled } from "../utils/concurrencyUtils.js";
import { matchesTitle, matchesLocationFilter } from "../utils/matcherUtils.js";
import { logger } from "../../utils/index.js";

export interface JobviteJobItem {
  id: string;
  title: string;
  location?: string;
  applyURL: string;
  category?: string;
  date?: string;
}

export interface JobviteApiResponse {
  jobs: JobviteJobItem[];
}

export class JobviteJobScraperAdapter extends BaseJobScraperAdapter {
  readonly name = "JobviteJobScraperAdapter";
  readonly source = "jobvite";

  private readonly companies: NamedSlugCompany[];
  private readonly timeoutMs: number;
  private readonly concurrency: number;

  constructor(options?: { companies?: NamedSlugCompany[]; timeoutMs?: number; concurrency?: number }) {
    super();
    this.companies = options?.companies ?? DEFAULT_JOBVITE_COMPANIES;
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
        const url = `https://jobs.jobvite.com/api/company/${company.slug}/jobs`;
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

          const data = (await response.json()) as JobviteApiResponse;
          const jobs = data.jobs || [];

          for (const item of jobs) {
            const title = item.title;
            const applyUrl = item.applyURL;
            if (!title || !applyUrl) continue;

            if (!matchesTitle(title, query.query, query.titles) && !matchesTitle(company.name, query.query, query.titles)) {
              continue;
            }

            const locationStr = item.location || "";
            const isRemote = locationStr.toLowerCase().includes("remote") || title.toLowerCase().includes("remote");

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

            const categories = item.category ? [item.category] : [];
            const postedAt = item.date ? new Date(item.date) : undefined;

            allJobs.push({
              id: `jobvite-${item.id || encodeURIComponent(applyUrl)}`,
              title,
              company: company.name,
              location: locationStr || (isRemote ? "Remote" : "On-site"),
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
