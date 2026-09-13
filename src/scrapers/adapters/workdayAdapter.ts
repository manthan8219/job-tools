import { BaseJobScraperAdapter } from "../baseAdapter.js";
import { ScrapeQuery, ScrapeResult, ScrapedJob } from "../types.js";
import { DEFAULT_WORKDAY_COMPANIES, NamedUrlCompany } from "../data/companies.js";
import { runWithConcurrencySettled } from "../utils/concurrencyUtils.js";
import { matchesTitle, matchesLocationFilter } from "../utils/matcherUtils.js";
import { logger } from "../../utils/index.js";

export interface WorkdayPosting {
  title: string;
  externalPath: string;
  locationsText?: string;
  postedOn?: string;
  timeType?: string;
  bulletFields?: string[];
}

export interface WorkdayApiResponse {
  total: number;
  jobPostings: WorkdayPosting[];
}

/**
 * Parses Workday relative date strings e.g. "Posted Today", "Posted 3 Days Ago"
 */
export function parseWorkdayPostedDate(postedOn?: string): Date | undefined {
  if (!postedOn) return undefined;
  const lower = postedOn.toLowerCase().trim();
  const now = new Date();

  if (lower === "posted today") return now;
  if (lower === "posted yesterday") {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  const daysMatch = lower.match(/^posted\s+(\d+)\s+days?\s+ago$/);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    if (!isNaN(days) && days < 30) {
      return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }
  }

  return undefined;
}

/**
 * Parses tenant, instance (e.g. wd5), and site slug from Workday career URL.
 * URL format: https://<tenant>.<instance>.myworkdayjobs.com[/<locale>]/<site>
 */
export function parseWorkdayUrl(rawUrl: string): { tenant: string; instance: string; site: string; baseUrl: string } | null {
  try {
    const parsed = new URL(rawUrl);
    if (!parsed.hostname.endsWith(".myworkdayjobs.com")) return null;

    const hostParts = parsed.hostname.split(".");
    if (hostParts.length < 4) return null;

    const tenant = hostParts[0];
    const instance = hostParts[1];

    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length === 0) return null;

    // Detect locale segment e.g. "en-US", "fr-CA"
    let site = segments[0];
    if (/^[a-z]{2}(?:-[a-z]{2})?$/i.test(segments[0]) && segments.length > 1) {
      site = segments[1];
    }

    const baseUrl = `https://${tenant}.${instance}.myworkdayjobs.com/${site}`;
    return { tenant, instance, site, baseUrl };
  } catch {
    return null;
  }
}

export class WorkdayJobScraperAdapter extends BaseJobScraperAdapter {
  readonly name = "WorkdayJobScraperAdapter";
  readonly source = "workday";

  private readonly companies: NamedUrlCompany[];
  private readonly timeoutMs: number;
  private readonly concurrency: number;

  constructor(options?: { companies?: NamedUrlCompany[]; timeoutMs?: number; concurrency?: number }) {
    super();
    this.companies = options?.companies ?? DEFAULT_WORKDAY_COMPANIES;
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
        const parsed = parseWorkdayUrl(company.url);
        if (!parsed) {
          logger.warn(`[${this.name}] Invalid Workday URL for ${company.name}: ${company.url}`);
          return;
        }

        const apiEndpoint = `https://${parsed.tenant}.${parsed.instance}.myworkdayjobs.com/wday/cxs/${parsed.tenant}/${parsed.site}/jobs`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
          const bodyPayload = {
            appliedFacets: {},
            limit: 20,
            offset: 0,
            searchText: query.query || "",
          };

          const response = await fetch(apiEndpoint, {
            method: "POST",
            headers: {
              "Accept": "application/json",
              "Content-Type": "application/json",
              "User-Agent": "JobTools-Scraper/1.0",
            },
            body: JSON.stringify(bodyPayload),
            signal: controller.signal,
          });

          if (!response.ok) {
            logger.warn(`[${this.name}] ${company.name} returned HTTP ${response.status}`);
            return;
          }

          const data = (await response.json()) as WorkdayApiResponse;
          const rawPostings = data.jobPostings || [];

          for (const item of rawPostings) {
            const title = item.title;
            if (!title || !item.externalPath) continue;

            if (!matchesTitle(title, query.query, query.titles) && !matchesTitle(company.name, query.query, query.titles)) {
              continue;
            }

            const locationStr = item.locationsText || "";
            const isRemote =
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

            const applyUrl = `${parsed.baseUrl.replace(/\/$/, "")}/${item.externalPath.replace(/^\//, "")}`;
            const postedAt = parseWorkdayPostedDate(item.postedOn);

            allJobs.push({
              id: `workday-${encodeURIComponent(applyUrl)}`,
              title,
              company: company.name,
              location: locationStr || (isRemote ? "Remote" : "On-site"),
              url: applyUrl,
              source: this.source,
              employmentType: item.timeType?.toLowerCase().includes("part") ? "part-time" : "full-time",
              workArrangement: isRemote ? "remote" : "on-site",
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
