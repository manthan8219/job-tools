import { BaseJobScraperAdapter } from "../baseAdapter.js";
import { ScrapeQuery, ScrapeResult, ScrapedJob } from "../types.js";
import { isLocationInCountry } from "../utils/countryUtils.js";
import { logger } from "../../utils/index.js";

export interface LeverJobItem {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl?: string;
  workplaceType?: "remote" | "hybrid" | "on-site" | "unspecified" | string;
  categories?: {
    commitment?: string;
    location?: string;
    team?: string;
    department?: string;
    allLocations?: string[];
  };
  description?: string;
  descriptionPlain?: string;
  createdAt?: number;
}

export class LeverJobScraperAdapter extends BaseJobScraperAdapter {
  readonly name = "LeverJobScraperAdapter";
  readonly source = "lever";

  private readonly companies: string[];
  private readonly timeoutMs: number;

  constructor(options?: { defaultCompanies?: string[]; timeoutMs?: number }) {
    super();
    this.companies = options?.defaultCompanies ?? ["palantir"];
    this.timeoutMs = options?.timeoutMs ?? 15000;
  }

  isConfigured(): boolean {
    return true;
  }

  protected async executeScrape(query: ScrapeQuery): Promise<ScrapeResult> {
    const allJobs: ScrapedJob[] = [];
    const searchTerms = (query.query || query.titles?.join(" ") || "").toLowerCase().trim();

    for (const company of this.companies) {
      const url = `https://api.lever.co/v0/postings/${company}?mode=json`;
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

        const rawJobs = (await response.json()) as LeverJobItem[];
        if (!Array.isArray(rawJobs)) continue;

        for (const item of rawJobs) {
          if (searchTerms) {
            const searchWords = searchTerms.split(/\s+/).filter(Boolean);
            const matches = searchWords.every(
              (word) =>
                item.text.toLowerCase().includes(word) ||
                item.categories?.team?.toLowerCase().includes(word) ||
                item.categories?.department?.toLowerCase().includes(word) ||
                (item.descriptionPlain && item.descriptionPlain.toLowerCase().includes(word))
            );
            if (!matches) {
              continue;
            }
          }

          const isRemote =
            item.workplaceType === "remote" ||
            item.text.toLowerCase().includes("remote") ||
            (item.categories?.location && item.categories.location.toLowerCase().includes("remote"));

          if (query.worldwideOnly && !isRemote) {
            continue;
          }

          // Abroad / country filtering
          const location = item.categories?.location || "";
          if (query.country && !isLocationInCountry(location, query.country)) {
            continue;
          }

          allJobs.push(this.mapToScrapedJob(item, company));
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

  private mapToScrapedJob(item: LeverJobItem, company: string): ScrapedJob {
    let workArrangement: ScrapedJob["workArrangement"] = "unknown";
    if (item.workplaceType === "remote") workArrangement = "remote";
    else if (item.workplaceType === "hybrid") workArrangement = "hybrid";
    else if (item.workplaceType === "on-site") workArrangement = "on-site";
    else if (item.text.toLowerCase().includes("remote")) workArrangement = "remote";

    let employmentType: ScrapedJob["employmentType"] = "unknown";
    if (item.categories?.commitment) {
      const c = item.categories.commitment.toLowerCase();
      if (c.includes("full")) employmentType = "full-time";
      else if (c.includes("part")) employmentType = "part-time";
      else if (c.includes("contract")) employmentType = "contract";
      else if (c.includes("intern")) employmentType = "internship";
    }

    const categories: string[] = [];
    if (item.categories?.team) categories.push(item.categories.team);
    if (item.categories?.department) categories.push(item.categories.department);

    return {
      id: `lever-${item.id}`,
      title: item.text,
      company,
      location: item.categories?.location || (workArrangement === "remote" ? "Remote" : "On-site"),
      description: item.description || item.descriptionPlain,
      url: item.hostedUrl,
      source: this.source,
      employmentType,
      workArrangement,
      categories,
      postedAt: item.createdAt ? new Date(item.createdAt) : undefined,
      scrapedAt: new Date(),
      rawData: item as unknown as Record<string, unknown>,
    };
  }
}
