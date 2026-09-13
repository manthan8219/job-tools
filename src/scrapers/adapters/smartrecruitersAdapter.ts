import { BaseJobScraperAdapter } from "../baseAdapter.js";
import { ScrapeQuery, ScrapeResult, ScrapedJob } from "../types.js";
import { DEFAULT_SMARTRECRUITERS_COMPANIES, NamedIdentifierCompany } from "../data/companies.js";
import { runWithConcurrencySettled } from "../utils/concurrencyUtils.js";
import { matchesTitle, matchesLocationFilter } from "../utils/matcherUtils.js";
import { logger } from "../../utils/index.js";

export interface SmartRecruitersPosting {
  id: string;
  name: string;
  releasedDate?: string;
  location?: {
    city?: string;
    region?: string;
    country?: string;
    remote?: boolean;
    fullLocation?: string;
  };
  department?: {
    label?: string;
  };
  typeOfEmployment?: {
    label?: string;
  };
}

export interface SmartRecruitersApiResponse {
  content: SmartRecruitersPosting[];
}

export class SmartRecruitersJobScraperAdapter extends BaseJobScraperAdapter {
  readonly name = "SmartRecruitersJobScraperAdapter";
  readonly source = "smartrecruiters";

  private readonly companies: NamedIdentifierCompany[];
  private readonly timeoutMs: number;
  private readonly concurrency: number;

  constructor(options?: { companies?: NamedIdentifierCompany[]; timeoutMs?: number; concurrency?: number }) {
    super();
    this.companies = options?.companies ?? DEFAULT_SMARTRECRUITERS_COMPANIES;
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
        const url = `https://api.smartrecruiters.com/v1/companies/${company.identifier}/postings?limit=100`;
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

          const data = (await response.json()) as SmartRecruitersApiResponse;
          const postings = data.content || [];

          for (const item of postings) {
            const title = item.name;
            if (!title || !item.id) continue;

            if (!matchesTitle(title, query.query, query.titles) && !matchesTitle(company.name, query.query, query.titles)) {
              continue;
            }

            const locationStr = item.location?.fullLocation || item.location?.city || "";
            const isRemote = Boolean(item.location?.remote) || locationStr.toLowerCase().includes("remote");

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

            const applyUrl = `https://jobs.smartrecruiters.com/${company.identifier}/${item.id}`;
            const postedAt = item.releasedDate ? new Date(item.releasedDate) : undefined;
            const categories = item.department?.label ? [item.department.label] : [];

            allJobs.push({
              id: `smartrecruiters-${item.id}`,
              title,
              company: company.name,
              location: locationStr || (isRemote ? "Remote" : "On-site"),
              url: applyUrl,
              source: this.source,
              employmentType: item.typeOfEmployment?.label?.toLowerCase().includes("part") ? "part-time" : "full-time",
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
