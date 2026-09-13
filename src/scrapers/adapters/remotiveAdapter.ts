import { BaseJobScraperAdapter } from "../baseAdapter.js";
import { ScrapeQuery, ScrapeResult, ScrapedJob } from "../types.js";
import { isLocationInCountry } from "../utils/countryUtils.js";
import { logger } from "../../utils/index.js";

export interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  company_logo?: string;
  category: string;
  tags?: string[];
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
}

export interface RemotiveResponse {
  "job-count"?: number;
  jobs?: RemotiveJob[];
}

export class RemotiveJobScraperAdapter extends BaseJobScraperAdapter {
  readonly name = "RemotiveJobScraperAdapter";
  readonly source = "remotive";

  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options?: { baseUrl?: string; timeoutMs?: number }) {
    super();
    this.baseUrl = options?.baseUrl ?? "https://remotive.com/api/remote-jobs";
    this.timeoutMs = options?.timeoutMs ?? 15000;
  }

  isConfigured(): boolean {
    return true;
  }

  protected async executeScrape(query: ScrapeQuery): Promise<ScrapeResult> {
    const url = new URL(this.baseUrl);

    // Default to software-dev category for tech roles
    url.searchParams.set("category", "software-dev");

    const searchTerms = query.query || query.titles?.join(" ");
    if (searchTerms) {
      url.searchParams.set("search", searchTerms);
    }

    if (query.limit) {
      url.searchParams.set("limit", query.limit.toString());
    }

    logger.info(`[${this.name}] Requesting URL: ${url.toString()}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "User-Agent": "JobTools-Scraper/1.0",
        },
        signal: controller.signal,
      });

      if (response.status === 429) {
        throw new Error("Rate limit reached on Remotive API (429). Please wait before retrying.");
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`Remotive API responded with HTTP ${response.status}: ${errText}`);
      }

      const data = (await response.json()) as RemotiveResponse;
      let rawJobs = data.jobs || [];

      if (query.country) {
        rawJobs = rawJobs.filter((j) => isLocationInCountry(j.candidate_required_location, query.country));
      }

      const scrapedJobs: ScrapedJob[] = rawJobs.map((j) => this.mapToScrapedJob(j));

      const totalCount = data["job-count"] ?? scrapedJobs.length;

      return {
        source: this.source,
        jobs: scrapedJobs,
        totalFound: totalCount,
        hasMore: false,
        pagesFetched: 1,
        fetchedAt: new Date(),
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private mapToScrapedJob(job: RemotiveJob): ScrapedJob {
    const { minSalary, maxSalary } = this.parseSalary(job.salary);

    let employmentType: ScrapedJob["employmentType"] = "unknown";
    if (job.job_type) {
      const jt = job.job_type.toLowerCase();
      if (jt.includes("full")) employmentType = "full-time";
      else if (jt.includes("part")) employmentType = "part-time";
      else if (jt.includes("contract")) employmentType = "contract";
      else if (jt.includes("intern")) employmentType = "internship";
      else if (jt.includes("temp")) employmentType = "temporary";
    }

    return {
      id: `remotive-${job.id}`,
      title: job.title,
      company: job.company_name,
      location: job.candidate_required_location || "Worldwide (Remote)",
      description: job.description,
      url: job.url,
      source: this.source,
      employmentType,
      workArrangement: "remote",
      salaryMin: minSalary,
      salaryMax: maxSalary,
      salaryCurrency: "USD",
      salaryPeriod: "annual",
      categories: job.tags ?? [],
      postedAt: job.publication_date ? new Date(job.publication_date) : undefined,
      scrapedAt: new Date(),
      rawData: job as unknown as Record<string, unknown>,
    };
  }

  private parseSalary(salaryStr?: string): { minSalary?: number; maxSalary?: number } {
    if (!salaryStr) return {};

    // Handles formats like "$120k - $150k" or "$100,000 - $140,000" or "$120k+"
    const kRegex = /\$?(\d+(?:\.\d+)?)\s*k/gi;
    const matches: number[] = [];
    let match;

    while ((match = kRegex.exec(salaryStr)) !== null) {
      matches.push(parseFloat(match[1]) * 1000);
    }

    if (matches.length >= 2) {
      return { minSalary: matches[0], maxSalary: matches[1] };
    } else if (matches.length === 1) {
      return { minSalary: matches[0] };
    }

    // Try normal numbers with commas e.g. 100,000
    const rawNumRegex = /\$?(\d{2,3}(?:,\d{3})+)/g;
    const numMatches: number[] = [];
    while ((match = rawNumRegex.exec(salaryStr)) !== null) {
      numMatches.push(parseInt(match[1].replace(/,/g, ""), 10));
    }

    if (numMatches.length >= 2) {
      return { minSalary: numMatches[0], maxSalary: numMatches[1] };
    } else if (numMatches.length === 1) {
      return { minSalary: numMatches[0] };
    }

    return {};
  }
}
