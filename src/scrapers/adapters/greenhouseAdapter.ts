import { BaseJobScraperAdapter } from "../baseAdapter.js";
import { ScrapeQuery, ScrapeResult, ScrapedJob } from "../types.js";
import { isLocationInCountry } from "../utils/countryUtils.js";
import { logger } from "../../utils/index.js";

export interface GreenhouseJobItem {
  id: number;
  title: string;
  absolute_url: string;
  location?: {
    name?: string;
  };
  departments?: Array<{
    id: number;
    name: string;
  }>;
  offices?: Array<{
    id: number;
    name: string;
    location?: string;
  }>;
  content?: string;
  updated_at?: string;
}

export interface GreenhouseBoardResponse {
  jobs?: GreenhouseJobItem[];
}

export class GreenhouseJobScraperAdapter extends BaseJobScraperAdapter {
  readonly name = "GreenhouseJobScraperAdapter";
  readonly source = "greenhouse";

  private readonly companies: string[];
  private readonly timeoutMs: number;

  constructor(options?: { defaultCompanies?: string[]; timeoutMs?: number }) {
    super();
    this.companies = options?.defaultCompanies ?? [
      "gitlab",
      "stripe",
      "celonis",
      "n26",
      "hootsuite",
      "figma",
      "datadog",
    ];
    this.timeoutMs = options?.timeoutMs ?? 15000;
  }

  isConfigured(): boolean {
    return true;
  }

  protected async executeScrape(query: ScrapeQuery): Promise<ScrapeResult> {
    const allJobs: ScrapedJob[] = [];
    const searchTerms = (query.query || query.titles?.join(" ") || "").toLowerCase();

    for (const company of this.companies) {
      const url = `https://boards-api.greenhouse.io/v1/boards/${company}/jobs?content=true`;
      logger.info(`[${this.name}] Fetching board for company '${company}': ${url}`);

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
          logger.warn(`[${this.name}] Failed to fetch company '${company}' (HTTP ${response.status})`);
          continue;
        }

        const data = (await response.json()) as GreenhouseBoardResponse;
        const rawJobs = data.jobs || [];

        for (const item of rawJobs) {
          if (searchTerms) {
            const searchWords = searchTerms.split(/\s+/).filter(Boolean);
            const matches = searchWords.every(
              (word) =>
                item.title.toLowerCase().includes(word) ||
                item.departments?.some((d) => d.name.toLowerCase().includes(word)) ||
                (item.content && item.content.toLowerCase().includes(word))
            );
            if (!matches) {
              continue;
            }
          }

          const locationName = item.location?.name || "";
          const isRemote = locationName.toLowerCase().includes("remote") || item.title.toLowerCase().includes("remote");

          if (query.worldwideOnly && !isRemote) {
            continue;
          }

          // Abroad / country filtering
          if (query.country && !isLocationInCountry(locationName, query.country)) {
            continue;
          }

          allJobs.push(this.mapToScrapedJob(item, company, isRemote));
        }
      } catch (err: any) {
        logger.error(`[${this.name}] Error fetching company '${company}': ${err.message}`);
      } finally {
        clearTimeout(timeoutId);
      }
    }

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

  private mapToScrapedJob(item: GreenhouseJobItem, company: string, isRemote: boolean): ScrapedJob {
    const categories: string[] = [];
    if (item.departments) {
      categories.push(...item.departments.map((d) => d.name));
    }

    // Decode escaped HTML if present
    const decodedContent = item.content
      ? item.content.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
      : undefined;

    return {
      id: `greenhouse-${item.id}`,
      title: item.title,
      company,
      location: item.location?.name || (isRemote ? "Remote" : "On-site"),
      description: decodedContent,
      url: item.absolute_url,
      source: this.source,
      employmentType: "full-time",
      workArrangement: isRemote ? "remote" : "on-site",
      categories,
      postedAt: item.updated_at ? new Date(item.updated_at) : undefined,
      scrapedAt: new Date(),
      rawData: item as unknown as Record<string, unknown>,
    };
  }
}
