import { BaseJobScraperAdapter } from "../baseAdapter.js";
import { ScrapeQuery, ScrapeResult, ScrapedJob } from "../types.js";
import { DEFAULT_PERSONIO_COMPANIES, NamedSlugCompany } from "../data/companies.js";
import { runWithConcurrencySettled } from "../utils/concurrencyUtils.js";
import { sanitizeXmlEntities } from "../utils/xmlUtils.js";
import { matchesTitle, matchesLocationFilter } from "../utils/matcherUtils.js";
import { XMLParser } from "fast-xml-parser";
import { logger } from "../../utils/index.js";

export class PersonioJobScraperAdapter extends BaseJobScraperAdapter {
  readonly name = "PersonioJobScraperAdapter";
  readonly source = "personio";

  private readonly companies: NamedSlugCompany[];
  private readonly timeoutMs: number;
  private readonly concurrency: number;
  private readonly parser: XMLParser;

  constructor(options?: { companies?: NamedSlugCompany[]; timeoutMs?: number; concurrency?: number }) {
    super();
    this.companies = options?.companies ?? DEFAULT_PERSONIO_COMPANIES;
    this.timeoutMs = options?.timeoutMs ?? 15000;
    this.concurrency = options?.concurrency ?? 5;
    this.parser = new XMLParser({
      ignoreAttributes: false,
      textNodeName: "#text",
      trimValues: true,
    });
  }

  isConfigured(): boolean {
    return true;
  }

  protected async executeScrape(query: ScrapeQuery): Promise<ScrapeResult> {
    const allJobs: ScrapedJob[] = [];

    await runWithConcurrencySettled(
      this.companies,
      async (company) => {
        const url = `https://${company.slug}.jobs.personio.de/xml`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
          const response = await fetch(url, {
            method: "GET",
            headers: {
              "Accept": "application/xml, text/xml",
              "User-Agent": "JobTools-Scraper/1.0",
            },
            signal: controller.signal,
          });

          if (!response.ok) {
            return;
          }

          const rawXml = await response.text();
          const sanitized = sanitizeXmlEntities(rawXml);
          const parsed = this.parser.parse(sanitized);

          const rawPositions =
            parsed?.["work-positions"]?.position ||
            parsed?.workPositions?.position ||
            parsed?.positions?.position ||
            [];

          const positions = Array.isArray(rawPositions) ? rawPositions : [rawPositions];

          for (const pos of positions) {
            const title = String(pos.name || pos.jobPosition || pos.title || "").trim();
            const applyUrl = String(pos.url || pos.applyUrl || "").trim();
            if (!title || !applyUrl) continue;

            if (!matchesTitle(title, query.query, query.titles) && !matchesTitle(company.name, query.query, query.titles)) {
              continue;
            }

            const locationStr = String(pos.jobLocation || pos.office || pos.city || "").trim();
            const isRemote =
              locationStr.toLowerCase().includes("remote") ||
              title.toLowerCase().includes("remote") ||
              String(pos.workplaceType || "").toLowerCase() === "remote";

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

            const department = pos.department ? [String(pos.department)] : [];
            const id = pos.id ? String(pos.id) : encodeURIComponent(applyUrl);

            allJobs.push({
              id: `personio-${company.slug}-${id}`,
              title,
              company: company.name,
              location: locationStr || (isRemote ? "Remote" : "On-site"),
              url: applyUrl,
              source: this.source,
              employmentType: String(pos.employmentType || "").toLowerCase().includes("part") ? "part-time" : "full-time",
              workArrangement: isRemote ? "remote" : "on-site",
              categories: department,
              scrapedAt: new Date(),
              rawData: pos as unknown as Record<string, unknown>,
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
