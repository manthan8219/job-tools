import { BaseJobScraperAdapter } from "../baseAdapter.js";
import { ScrapeQuery, ScrapeResult, ScrapedJob } from "../types.js";
import { logger } from "../../utils/index.js";

export interface RemoteOKJobItem {
  id: string | number;
  position?: string;
  company?: string;
  company_logo?: string;
  tags?: string[];
  description?: string;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  url?: string;
  apply_url?: string;
  date?: string;
  legal?: string;
}

export class RemoteOKJobScraperAdapter extends BaseJobScraperAdapter {
  readonly name = "RemoteOKJobScraperAdapter";
  readonly source = "remoteok";

  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options?: { baseUrl?: string; timeoutMs?: number }) {
    super();
    this.baseUrl = options?.baseUrl ?? "https://remoteok.com/api";
    this.timeoutMs = options?.timeoutMs ?? 15000;
  }

  isConfigured(): boolean {
    return true;
  }

  protected async executeScrape(query: ScrapeQuery): Promise<ScrapeResult> {
    const url = this.baseUrl;
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
        const errText = await response.text().catch(() => "");
        throw new Error(`RemoteOK API responded with HTTP ${response.status}: ${errText}`);
      }

      const rawItems = (await response.json()) as RemoteOKJobItem[];
      if (!Array.isArray(rawItems)) {
        return {
          source: this.source,
          jobs: [],
          totalFound: 0,
          hasMore: false,
          pagesFetched: 1,
          fetchedAt: new Date(),
        };
      }

      // Filter out metadata elements that have no position
      const validJobs = rawItems.filter((item) => Boolean(item.position && item.id));

      const searchTerms = (query.query || query.titles?.join(" ") || "").toLowerCase().trim();
      const searchWords = searchTerms.split(/\s+/).filter(Boolean);

      const matchedJobs: ScrapedJob[] = [];

      for (const item of validJobs) {
        if (searchWords.length > 0) {
          const matches = searchWords.every(
            (word) =>
              item.position?.toLowerCase().includes(word) ||
              item.company?.toLowerCase().includes(word) ||
              item.tags?.some((t) => t.toLowerCase().includes(word)) ||
              item.description?.toLowerCase().includes(word)
          );
          if (!matches) {
            continue;
          }
        }

        matchedJobs.push(this.mapToScrapedJob(item));
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

  private mapToScrapedJob(job: RemoteOKJobItem): ScrapedJob {
    const minSalary = job.salary_min && job.salary_min > 0 ? job.salary_min : undefined;
    const maxSalary = job.salary_max && job.salary_max > 0 ? job.salary_max : undefined;

    return {
      id: `remoteok-${job.id}`,
      title: job.position || "Untitled Remote Role",
      company: job.company || "Unknown Company",
      location: job.location || "Worldwide (Remote)",
      description: job.description,
      url: job.apply_url || job.url || `https://remoteok.com/remote-jobs/${job.id}`,
      source: this.source,
      employmentType: "full-time",
      workArrangement: "remote",
      salaryMin: minSalary,
      salaryMax: maxSalary,
      salaryCurrency: "USD",
      salaryPeriod: "annual",
      categories: job.tags ?? [],
      postedAt: job.date ? new Date(job.date) : undefined,
      scrapedAt: new Date(),
      rawData: job as unknown as Record<string, unknown>,
    };
  }
}
