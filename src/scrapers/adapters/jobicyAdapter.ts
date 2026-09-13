import { BaseJobScraperAdapter } from "../baseAdapter.js";
import { ScrapeQuery, ScrapeResult, ScrapedJob } from "../types.js";
import { logger } from "../../utils/index.js";

export interface JobicyItem {
  id: number;
  url: string;
  jobSlug?: string;
  jobTitle: string;
  companyName: string;
  companyLogo?: string;
  jobIndustry?: string[];
  jobType?: string[];
  jobGeo?: string;
  jobLevel?: string;
  jobExcerpt?: string;
  jobDescription?: string;
  pubDate?: string;
  annualSalaryMin?: string | number | null;
  annualSalaryMax?: string | number | null;
  salaryCurrency?: string | null;
}

export interface JobicyApiResponse {
  jobs?: JobicyItem[];
}

export class JobicyJobScraperAdapter extends BaseJobScraperAdapter {
  readonly name = "JobicyJobScraperAdapter";
  readonly source = "jobicy";

  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options?: { baseUrl?: string; timeoutMs?: number }) {
    super();
    this.baseUrl = options?.baseUrl ?? "https://jobicy.com/api/v2/remote-jobs";
    this.timeoutMs = options?.timeoutMs ?? 15000;
  }

  isConfigured(): boolean {
    return true;
  }

  protected async executeScrape(query: ScrapeQuery): Promise<ScrapeResult> {
    const url = new URL(this.baseUrl);

    const limit = Math.min(query.limit ?? 20, 50);
    url.searchParams.set("count", limit.toString());
    url.searchParams.set("industry", "engineering");

    const searchTerms = query.query || query.titles?.join(" ");
    if (searchTerms) {
      url.searchParams.set("tag", searchTerms);
    }

    if (query.country) {
      const geo = this.mapCountryToGeo(query.country);
      if (geo) {
        url.searchParams.set("geo", geo);
      }
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

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`Jobicy API responded with HTTP ${response.status}: ${errText}`);
      }

      const data = (await response.json()) as JobicyApiResponse;
      const rawJobs = data.jobs || [];
      const scrapedJobs: ScrapedJob[] = rawJobs.map((j) => this.mapToScrapedJob(j));

      return {
        source: this.source,
        jobs: scrapedJobs,
        totalFound: scrapedJobs.length,
        hasMore: false,
        pagesFetched: 1,
        fetchedAt: new Date(),
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private mapToScrapedJob(job: JobicyItem): ScrapedJob {
    let minSalary: number | undefined;
    let maxSalary: number | undefined;

    if (job.annualSalaryMin) {
      minSalary = typeof job.annualSalaryMin === "number"
        ? job.annualSalaryMin
        : parseInt(job.annualSalaryMin, 10) || undefined;
    }
    if (job.annualSalaryMax) {
      maxSalary = typeof job.annualSalaryMax === "number"
        ? job.annualSalaryMax
        : parseInt(job.annualSalaryMax, 10) || undefined;
    }

    let employmentType: ScrapedJob["employmentType"] = "full-time";
    if (job.jobType && job.jobType.length > 0) {
      const jt = job.jobType.join(" ").toLowerCase();
      if (jt.includes("contract")) employmentType = "contract";
      else if (jt.includes("part")) employmentType = "part-time";
      else if (jt.includes("intern")) employmentType = "internship";
    }

    const location = job.jobGeo ? `${job.jobGeo} (Remote)` : "Worldwide (Remote)";

    return {
      id: `jobicy-${job.id}`,
      title: job.jobTitle,
      company: job.companyName,
      location,
      excerpt: job.jobExcerpt,
      description: job.jobDescription,
      url: job.url,
      source: this.source,
      employmentType,
      workArrangement: "remote",
      salaryMin: minSalary,
      salaryMax: maxSalary,
      salaryCurrency: job.salaryCurrency || "USD",
      salaryPeriod: "annual",
      categories: job.jobIndustry ?? [],
      postedAt: job.pubDate ? new Date(job.pubDate) : undefined,
      scrapedAt: new Date(),
      rawData: job as unknown as Record<string, unknown>,
    };
  }

  private mapCountryToGeo(country: string): string | undefined {
    const c = country.toLowerCase().trim();
    if (c === "us" || c === "usa" || c === "united states") return "usa";
    if (c === "ca" || c === "canada") return "canada";
    if (c === "uk" || c === "united kingdom" || c === "gb") return "uk";
    if (c === "eu" || c === "europe") return "europe";
    if (c === "apac" || c === "asia") return "apac";
    if (c === "latam") return "latam";
    return undefined;
  }
}
