import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { JobService } from "../../jobs/services/jobService.js";
import {
  WorkArrangementEnum,
  EmploymentTypeEnum,
  ExperienceLevelEnum,
} from "../../jobs/models/job.js";

const jobService = new JobService();

/**
 * MCP Tool to search the global PostgreSQL jobs database with hierarchical location and skills filtering
 */
export const searchJobsDatabaseTool = createTool({
  id: "search-jobs-database",
  description:
    "Searches the global PostgreSQL jobs database. Supports hierarchical filtering by country (e.g. 'DE', 'CA', 'US'), city slug (e.g. 'munich', 'toronto', 'san-francisco'), work arrangement (remote, hybrid), skills, and keywords.",
  inputSchema: z.object({
    query: z.string().optional().describe("Job title or keywords (e.g. 'Backend Engineer', 'React')"),
    countryCode: z.string().optional().describe("Country ISO alpha-2 code (e.g. 'DE', 'CA', 'US', 'GB', 'IN')"),
    citySlug: z.string().optional().describe("City slug (e.g. 'munich', 'berlin', 'toronto', 'vancouver', 'san-francisco')"),
    workArrangement: WorkArrangementEnum.optional().describe("Work arrangement: remote, hybrid, on-site"),
    employmentType: EmploymentTypeEnum.optional(),
    experienceLevel: ExperienceLevelEnum.optional(),
    skills: z.array(z.string()).optional().describe("List of tech skills to filter by (e.g. ['TypeScript', 'PostgreSQL'])"),
    salaryMin: z.number().optional().describe("Minimum annual salary threshold"),
    limit: z.number().int().positive().max(50).default(20).describe("Max results (default 20)"),
    offset: z.number().int().nonnegative().default(0).describe("Pagination offset"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    totalFound: z.number(),
    returned: z.number(),
    limit: z.number(),
    offset: z.number(),
    jobs: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        company: z.string(),
        location: z.string().nullable().optional(),
        countryCode: z.string().nullable().optional(),
        workArrangement: z.string(),
        employmentType: z.string(),
        skills: z.array(z.string()),
        salaryMin: z.number().nullable().optional(),
        salaryMax: z.number().nullable().optional(),
        salaryCurrency: z.string(),
        applyUrl: z.string(),
        source: z.string(),
        postedAt: z.date().nullable().optional(),
      })
    ),
  }),
  execute: async (input) => {
    try {
      const result = await jobService.searchJobs(input || {});
      return {
        success: true,
        totalFound: result.totalFound,
        returned: result.jobs.length,
        limit: result.limit,
        offset: result.offset,
        jobs: result.jobs.map((j) => ({
          id: j.id,
          title: j.title,
          company: j.company,
          location: j.locationName || j.rawLocation,
          countryCode: j.countryCode,
          workArrangement: j.workArrangement,
          employmentType: j.employmentType,
          skills: j.skills || [],
          salaryMin: j.salaryMin,
          salaryMax: j.salaryMax,
          salaryCurrency: j.salaryCurrency,
          applyUrl: j.applyUrl,
          source: j.source,
          postedAt: j.postedAt,
        })),
      };
    } catch (error: any) {
      return {
        success: false,
        totalFound: 0,
        returned: 0,
        limit: input?.limit ?? 20,
        offset: input?.offset ?? 0,
        jobs: [],
        error: error.message,
      } as any;
    }
  },
});

/**
 * MCP Tool to retrieve full details and full HTML description of a specific job by ID
 */
export const getJobDetailsTool = createTool({
  id: "get-job-details",
  description: "Retrieves complete details, full HTML description, and application routing for a specific job by its ID.",
  inputSchema: z.object({
    id: z.string().uuid().describe("Unique UUID of the job"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    job: z
      .object({
        id: z.string(),
        jobKey: z.string(),
        title: z.string(),
        company: z.string(),
        description: z.string().nullable().optional(),
        excerpt: z.string().nullable().optional(),
        applyUrl: z.string(),
        applyType: z.string(),
        applyEmail: z.string().nullable().optional(),
        workArrangement: z.string(),
        employmentType: z.string(),
        experienceLevel: z.string(),
        skills: z.array(z.string()),
        categories: z.array(z.string()),
        salaryMin: z.number().nullable().optional(),
        salaryMax: z.number().nullable().optional(),
        salaryCurrency: z.string(),
        salaryPeriod: z.string(),
        rawLocation: z.string().nullable().optional(),
        source: z.string(),
        status: z.string(),
        postedAt: z.date().nullable().optional(),
      })
      .nullable()
      .optional(),
    message: z.string().optional(),
  }),
  execute: async (input) => {
    const job = await jobService.getJobDetails(input.id);
    if (!job) {
      return {
        success: false,
        message: `Job with ID '${input.id}' not found.`,
      };
    }
    return {
      success: true,
      job,
    };
  },
});
