import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  HimalayasJobScraperAdapter,
  RemotiveJobScraperAdapter,
  AshbyJobScraperAdapter,
  GreenhouseJobScraperAdapter,
  JobicyJobScraperAdapter,
  LeverJobScraperAdapter,
  RemoteOKJobScraperAdapter,
  HackerNewsHiringAdapter,
  JobScraperAdapter,
  ScrapedJob,
} from "../../scrapers/index.js";
import { JobService } from "../../jobs/services/jobService.js";

const jobService = new JobService();

const adaptersMap: Record<string, JobScraperAdapter> = {
  himalayas: new HimalayasJobScraperAdapter(),
  remotive: new RemotiveJobScraperAdapter(),
  ashby: new AshbyJobScraperAdapter(),
  greenhouse: new GreenhouseJobScraperAdapter(),
  jobicy: new JobicyJobScraperAdapter(),
  lever: new LeverJobScraperAdapter(),
  remoteok: new RemoteOKJobScraperAdapter(),
  hackernews: new HackerNewsHiringAdapter(),
};

export const scrapeJobsTool = createTool({
  id: "scrape-jobs",
  description: "Scrapes job postings matching titles or queries across 8 remote platforms and ATS boards (Himalayas, Remotive, Ashby, Greenhouse, Jobicy, Lever, RemoteOK, Hacker News) with normalization.",
  inputSchema: z.object({
    query: z.string().optional().describe("Job title or search keywords, e.g. 'Software Developer'"),
    titles: z.array(z.string()).optional().describe("Target job titles list, e.g. ['Software Developer', 'Backend Engineer']"),
    sources: z.array(z.enum([
      "all",
      "himalayas",
      "remotive",
      "ashby",
      "greenhouse",
      "jobicy",
      "lever",
      "remoteok",
      "hackernews",
    ])).optional().default(["all"]).describe("Which sources to scrape. Defaults to 'all'"),
    country: z.string().optional().describe("Optional country filter (ISO alpha-2 code e.g. 'US', 'CA', 'IN')"),
    worldwideOnly: z.boolean().optional().describe("If true, only returns jobs open worldwide without location restrictions"),
    limit: z.number().int().positive().max(50).default(20).describe("Max jobs per source (max 50)"),
    page: z.number().int().positive().default(1).describe("Page number for search results"),
    maxPages: z.number().int().positive().default(1).describe("Number of pages to auto-paginate through (default 1)"),
    saveToDatabase: z.boolean().default(false).optional().describe("If true, automatically ingests and deduplicates scraped jobs into the PostgreSQL jobs database"),
  }),
  execute: async (input) => {
    try {
      const searchTerm = input.query || input.titles?.join(" ") || "Software Developer";

      const selectedSources = (!input.sources || input.sources.includes("all"))
        ? Object.keys(adaptersMap)
        : input.sources;

      const jobsMap = new Map<string, ScrapedJob>();
      let totalFound = 0;
      const sourceSummaries: Record<string, { totalFound: number; jobsReturned: number; error?: string }> = {};

      for (const sourceKey of selectedSources) {
        const adapter = adaptersMap[sourceKey];
        if (!adapter) continue;

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
      }

      const deduplicatedJobs = Array.from(jobsMap.values());
      let savedToDbCount = 0;

      if (input.saveToDatabase) {
        for (const job of deduplicatedJobs) {
          try {
            await jobService.ingestScrapedJob(job);
            savedToDbCount++;
          } catch (ingestErr) {
            // Continue ingesting remainder
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
