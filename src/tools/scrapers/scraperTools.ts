import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  // Original 8 adapters
  HimalayasJobScraperAdapter,
  RemotiveJobScraperAdapter,
  AshbyJobScraperAdapter,
  GreenhouseJobScraperAdapter,
  JobicyJobScraperAdapter,
  LeverJobScraperAdapter,
  RemoteOKJobScraperAdapter,
  HackerNewsHiringAdapter,
  // Remote & Tech Aggregators (new)
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
  // Enterprise ATS Platform Adapters (new)
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
  // Types
  JobScraperAdapter,
  ScrapedJob,
} from "../../scrapers/index.js";
import { JobService } from "../../jobs/services/jobService.js";

const jobService = new JobService();

const adaptersMap: Record<string, JobScraperAdapter> = {
  // Remote-first job boards
  himalayas: new HimalayasJobScraperAdapter(),
  remotive: new RemotiveJobScraperAdapter(),
  jobicy: new JobicyJobScraperAdapter(),
  remoteok: new RemoteOKJobScraperAdapter(),
  hackernews: new HackerNewsHiringAdapter(),
  arbeitnow: new ArbeitnowJobScraperAdapter(),
  weworkremotely: new WeWorkRemotelyJobScraperAdapter(),
  workingnomads: new WorkingNomadsJobScraperAdapter(),
  themuse: new TheMuseJobScraperAdapter(),
  fourday: new FourDayWeekJobScraperAdapter(),
  getonbrd: new GetOnBrdJobScraperAdapter(),
  echojobs: new EchoJobsJobScraperAdapter(),
  remoteco: new RemoteCoJobScraperAdapter(),
  dynamitejobs: new DynamiteJobsJobScraperAdapter(),
  euroremotejobs: new EuroRemoteJobsJobScraperAdapter(),
  nodesk: new NoDeskJobScraperAdapter(),
  nofluffjobs: new NoFluffJobsJobScraperAdapter(),
  justjoin: new JustJoinJobScraperAdapter(),
  wttj: new WttjJobScraperAdapter(),
  // ATS platforms
  ashby: new AshbyJobScraperAdapter(),
  greenhouse: new GreenhouseJobScraperAdapter(),
  lever: new LeverJobScraperAdapter(),
  workday: new WorkdayJobScraperAdapter(),
  smartrecruiters: new SmartRecruitersJobScraperAdapter(),
  workable: new WorkableJobScraperAdapter(),
  bamboohr: new BambooHRJobScraperAdapter(),
  breezy: new BreezyJobScraperAdapter(),
  pinpoint: new PinpointJobScraperAdapter(),
  recruitee: new RecruiteeJobScraperAdapter(),
  jobvite: new JobviteJobScraperAdapter(),
  personio: new PersonioJobScraperAdapter(),
  teamtailor: new TeamtailorJobScraperAdapter(),
};

const ALL_SOURCE_KEYS = Object.keys(adaptersMap) as [string, ...string[]];

export const scrapeJobsTool = createTool({
  id: "scrape-jobs",
  description:
    "Scrapes job postings matching titles or queries across 33 job platforms: remote-first boards (Himalayas, Remotive, RemoteOK, Jobicy, Arbeitnow, WeWorkRemotely, WorkingNomads, The Muse, 4DayWeek, GetOnBrd, EchoJobs, Remote.co, DynamiteJobs, EuroRemoteJobs, NoDesk, NoFluffJobs, JustJoin, WTTJ, Hacker News) and ATS platforms (Ashby, Greenhouse, Lever, Workday, SmartRecruiters, Workable, BambooHR, Breezy, Pinpoint, Recruitee, Jobvite, Personio, Teamtailor). Returns normalized, deduplicated job listings.",
  inputSchema: z.object({
    query: z.string().optional().describe("Job title or search keywords, e.g. 'Software Developer'"),
    titles: z.array(z.string()).optional().describe("Target job titles list, e.g. ['Software Developer', 'Backend Engineer']"),
    sources: z
      .array(
        z.enum([
          "all",
          // Remote boards
          "himalayas", "remotive", "jobicy", "remoteok", "hackernews",
          "arbeitnow", "weworkremotely", "workingnomads", "themuse",
          "fourday", "getonbrd", "echojobs", "remoteco", "dynamitejobs",
          "euroremotejobs", "nodesk", "nofluffjobs", "justjoin", "wttj",
          // ATS
          "ashby", "greenhouse", "lever", "workday", "smartrecruiters",
          "workable", "bamboohr", "breezy", "pinpoint", "recruitee",
          "jobvite", "personio", "teamtailor",
        ])
      )
      .optional()
      .default(["all"])
      .describe("Which sources to scrape. Defaults to 'all'. Specify a subset to target specific platforms."),
    country: z.string().optional().describe("Optional country filter (ISO alpha-2 code e.g. 'US', 'CA', 'IN', 'DE')"),
    worldwideOnly: z.boolean().optional().describe("If true, only returns remote jobs open worldwide without location restrictions"),
    limit: z.number().int().positive().max(50).default(20).describe("Max jobs per source (max 50)"),
    page: z.number().int().positive().default(1).describe("Page number for search results"),
    maxPages: z.number().int().positive().default(1).describe("Number of pages to auto-paginate through (default 1)"),
    saveToDatabase: z
      .boolean()
      .default(false)
      .optional()
      .describe("If true, automatically ingests and deduplicates scraped jobs into the PostgreSQL jobs database"),
  }),
  execute: async (input) => {
    try {
      const searchTerm = input.query || input.titles?.join(" ") || "Software Developer";

      const selectedSources = !input.sources || input.sources.includes("all")
        ? ALL_SOURCE_KEYS
        : (input.sources as string[]);

      const jobsMap = new Map<string, ScrapedJob>();
      let totalFound = 0;
      const sourceSummaries: Record<string, { totalFound: number; jobsReturned: number; error?: string }> = {};

      // Run all adapters concurrently for speed
      await Promise.allSettled(
        selectedSources.map(async (sourceKey) => {
          const adapter = adaptersMap[sourceKey];
          if (!adapter) return;

          try {
            const res = await adapter.scrape({
              query: searchTerm,
              titles: input.titles,
              country: input.country,
              worldwideOnly: input.worldwideOnly,
              limit: input.limit,
              page: input.page,
              maxPages: input.maxPages,
            });

            totalFound += res.totalFound;
            sourceSummaries[sourceKey] = {
              totalFound: res.totalFound,
              jobsReturned: res.jobs.length,
              error: res.error,
            };

            for (const job of res.jobs) {
              if (!jobsMap.has(job.id)) {
                jobsMap.set(job.id, job);
              }
            }
          } catch (err: any) {
            sourceSummaries[sourceKey] = {
              totalFound: 0,
              jobsReturned: 0,
              error: err.message,
            };
          }
        })
      );

      const deduplicatedJobs = Array.from(jobsMap.values());
      let savedToDbCount = 0;

      if (input.saveToDatabase) {
        for (const job of deduplicatedJobs) {
          try {
            await jobService.ingestScrapedJob(job);
            savedToDbCount++;
          } catch (_ingestErr) {
            // Continue ingesting remainder — individual failures are non-fatal
          }
        }
      }

      return {
        success: true,
        data: {
          query: searchTerm,
          sourcesQueried: selectedSources,
          totalFound,
          jobsCount: deduplicatedJobs.length,
          savedToDbCount: input.saveToDatabase ? savedToDbCount : undefined,
          sourceSummaries,
          jobs: deduplicatedJobs,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.name || "Error",
        message: error?.message || String(error),
      };
    }
  },
});
