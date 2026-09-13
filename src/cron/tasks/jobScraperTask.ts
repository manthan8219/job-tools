import { CronTask, CronTaskResult } from "../types.js";
import {
  JobScraperAdapter,
  ScrapeQuery,
  ScrapedJob,
  // Original adapters
  HimalayasJobScraperAdapter,
  RemotiveJobScraperAdapter,
  AshbyJobScraperAdapter,
  GreenhouseJobScraperAdapter,
  JobicyJobScraperAdapter,
  LeverJobScraperAdapter,
  RemoteOKJobScraperAdapter,
  HackerNewsHiringAdapter,
  // Remote & tech aggregator adapters
  ArbeitnowJobScraperAdapter,
  WeWorkRemotelyJobScraperAdapter,
  WorkingNomadsJobScraperAdapter,
  TheMuseJobScraperAdapter,
  FourDayWeekJobScraperAdapter,
  GetOnBrdJobScraperAdapter,
  EchoJobsJobScraperAdapter,
  RemoteCoJobScraperAdapter,
  DynamiteJobsJobScraperAdapter,
  EuroRemoteJobsJobScraperAdapter,
  NoDeskJobScraperAdapter,
  NoFluffJobsJobScraperAdapter,
  JustJoinJobScraperAdapter,
  WttjJobScraperAdapter,
  // Enterprise ATS adapters
  WorkdayJobScraperAdapter,
  SmartRecruitersJobScraperAdapter,
  WorkableJobScraperAdapter,
  BambooHRJobScraperAdapter,
  BreezyJobScraperAdapter,
  PinpointJobScraperAdapter,
  RecruiteeJobScraperAdapter,
  JobviteJobScraperAdapter,
  PersonioJobScraperAdapter,
  TeamtailorJobScraperAdapter,
} from "../../scrapers/index.js";
import { logger } from "../../utils/index.js";

/** All 33 built-in scraper adapters. */
function buildDefaultAdapters(): JobScraperAdapter[] {
  return [
    // Remote-first job boards
    new HimalayasJobScraperAdapter(),
    new RemotiveJobScraperAdapter(),
    new JobicyJobScraperAdapter(),
    new RemoteOKJobScraperAdapter(),
    new HackerNewsHiringAdapter(),
    new ArbeitnowJobScraperAdapter(),
    new WeWorkRemotelyJobScraperAdapter(),
    new WorkingNomadsJobScraperAdapter(),
    new TheMuseJobScraperAdapter(),
    new FourDayWeekJobScraperAdapter(),
    new GetOnBrdJobScraperAdapter(),
    new EchoJobsJobScraperAdapter(),
    new RemoteCoJobScraperAdapter(),
    new DynamiteJobsJobScraperAdapter(),
    new EuroRemoteJobsJobScraperAdapter(),
    new NoDeskJobScraperAdapter(),
    new NoFluffJobsJobScraperAdapter(),
    new JustJoinJobScraperAdapter(),
    new WttjJobScraperAdapter(),
    // ATS platforms
    new AshbyJobScraperAdapter(),
    new GreenhouseJobScraperAdapter(),
    new LeverJobScraperAdapter(),
    new WorkdayJobScraperAdapter(),
    new SmartRecruitersJobScraperAdapter(),
    new WorkableJobScraperAdapter(),
    new BambooHRJobScraperAdapter(),
    new BreezyJobScraperAdapter(),
    new PinpointJobScraperAdapter(),
    new RecruiteeJobScraperAdapter(),
    new JobviteJobScraperAdapter(),
    new PersonioJobScraperAdapter(),
    new TeamtailorJobScraperAdapter(),
  ];
}

export class JobScraperTask implements CronTask {
  readonly name = "JobScraperTask";
  readonly intervalMs: number;
  readonly enabled: boolean;
  private adapters: JobScraperAdapter[] = [];

  constructor(options?: { intervalMs?: number; enabled?: boolean; adapters?: JobScraperAdapter[] }) {
    // Default to running every 6 hours (6 * 60 * 60 * 1000 = 21,600,000 ms)
    this.intervalMs = options?.intervalMs ?? 6 * 60 * 60 * 1000;
    this.enabled = options?.enabled ?? true;

    if (options?.adapters) {
      this.adapters = options.adapters;
    } else {
      this.adapters = buildDefaultAdapters();
    }
  }

  registerAdapter(adapter: JobScraperAdapter): void {
    this.adapters.push(adapter);
    logger.info(`[${this.name}] Registered scraper adapter: ${adapter.name} (${adapter.source})`);
  }

  getAdapters(): readonly JobScraperAdapter[] {
    return this.adapters;
  }

  async execute(query?: ScrapeQuery): Promise<CronTaskResult> {
    const startedAt = new Date();
    logger.info(`[${this.name}] Starting job scraper cron execution with ${this.adapters.length} adapters...`);

    const targetTitles =
      query?.titles && query.titles.length > 0
        ? query.titles
        : [query?.query || "Software Developer"];

    const jobsMap = new Map<string, ScrapedJob>();

    try {
      for (const title of targetTitles) {
        logger.info(`[${this.name}] Scraping positions for title: "${title}"`);

        const searchQuery: ScrapeQuery = {
          ...query,
          query: title,
          limit: query?.limit ?? 20,
          maxPages: query?.maxPages ?? 1,
        };

        // Run all adapters concurrently per title for speed
        await Promise.allSettled(
          this.adapters.map(async (adapter) => {
            if (!adapter.isConfigured()) {
              logger.warn(`[${this.name}] Skipping unconfigured adapter: ${adapter.name}`);
              return;
            }

            try {
              const result = await adapter.scrape(searchQuery);
              for (const job of result.jobs) {
                if (!jobsMap.has(job.id)) {
                  jobsMap.set(job.id, job);
                }
              }
            } catch (err: any) {
              logger.error(`[${this.name}] Error running adapter ${adapter.name}: ${err.message}`);
            }
          })
        );
      }

      const completedAt = new Date();
      const totalCollected = jobsMap.size;
      logger.info(
        `[${this.name}] Finished execution. Processed and deduplicated ${totalCollected} unique jobs.`
      );

      return {
        taskName: this.name,
        startedAt,
        completedAt,
        status: "success",
        itemsProcessed: totalCollected,
        message: `Successfully collected ${totalCollected} unique jobs for [${targetTitles.join(", ")}] across ${this.adapters.length} adapters`,
      };
    } catch (error: any) {
      const completedAt = new Date();
      const message = error?.message || String(error);
      logger.error(`[${this.name}] Failed execution: ${message}`);

      return {
        taskName: this.name,
        startedAt,
        completedAt,
        status: "failed",
        itemsProcessed: jobsMap.size,
        error: message,
      };
    }
  }
}
