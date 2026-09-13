import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { JobService } from "../../jobs/services/jobService.js";
import { CompanyAtsTypeEnum } from "../../jobs/models/company.js";

const jobService = new JobService();

/**
 * MCP Tool to search companies in the PostgreSQL database with active job counts
 */
export const searchCompaniesTool = createTool({
  id: "search-companies",
  description:
    "Searches the global companies directory in PostgreSQL. Returns company profiles, ATS platforms (Greenhouse, Ashby, Lever, etc.), and their count of active job listings.",
  inputSchema: z.object({
    query: z.string().optional().describe("Company name or keyword (e.g. 'GitLab', 'Stripe')"),
    industry: z.string().optional().describe("Industry filter (e.g. 'Technology', 'Fintech')"),
    atsType: CompanyAtsTypeEnum.optional().describe("ATS platform (greenhouse, ashby, lever, workday, custom, unknown)"),
    limit: z.number().int().positive().max(50).default(20).describe("Max results to return (default 20)"),
    offset: z.number().int().nonnegative().default(0).describe("Pagination offset (default 0)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    totalFound: z.number(),
    returned: z.number(),
    limit: z.number(),
    offset: z.number(),
    companies: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        slug: z.string(),
        websiteUrl: z.string().nullable().optional(),
        logoUrl: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        industry: z.string().nullable().optional(),
        sizeRange: z.string().nullable().optional(),
        atsType: z.string().nullable().optional(),
        atsBoardToken: z.string().nullable().optional(),
        activeJobsCount: z.number(),
      })
    ),
  }),
  execute: async (input: any) => {
    try {
      const result = await jobService.searchCompanies(input || {});
      return {
        success: true,
        totalFound: result.totalFound,
        returned: result.companies.length,
        limit: input?.limit ?? 20,
        offset: input?.offset ?? 0,
        companies: result.companies.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          websiteUrl: c.websiteUrl,
          logoUrl: c.logoUrl,
          description: c.description,
          industry: c.industry,
          sizeRange: c.sizeRange,
          atsType: c.atsType,
          atsBoardToken: c.atsBoardToken,
          activeJobsCount: c.activeJobsCount,
        })),
      };
    } catch (error: any) {
      return {
        success: false,
        totalFound: 0,
        returned: 0,
        limit: input?.limit ?? 20,
        offset: input?.offset ?? 0,
        companies: [],
        error: error.message,
      } as any;
    }
  },
});

/**
 * MCP Tool to retrieve full company details and currently active job postings
 */
export const getCompanyDetailsTool = createTool({
  id: "get-company-details",
  description:
    "Retrieves full profile details for a company along with its currently active job postings using either company UUID or slug (e.g. 'gitlab', 'stripe').",
  inputSchema: z.object({
    idOrSlug: z.string().describe("Company UUID or slug (e.g. 'gitlab', 'stripe', 'linear')"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    company: z
      .object({
        id: z.string(),
        name: z.string(),
        slug: z.string(),
        websiteUrl: z.string().nullable().optional(),
        logoUrl: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        industry: z.string().nullable().optional(),
        sizeRange: z.string().nullable().optional(),
        atsType: z.string().nullable().optional(),
        atsBoardToken: z.string().nullable().optional(),
        isActive: z.boolean(),
        createdAt: z.date().optional(),
        updatedAt: z.date().optional(),
      })
      .nullable()
      .optional(),
    activeJobs: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        company: z.string(),
        location: z.string().nullable().optional(),
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
    error: z.string().optional(),
  }),
  execute: async (input: any) => {
    try {
      const details = await jobService.getCompanyDetails(input.idOrSlug);
      if (!details) {
        return {
          success: false,
          company: null,
          activeJobs: [],
          error: `Company '${input.idOrSlug}' not found`,
        };
      }

      return {
        success: true,
        company: details.company,
        activeJobs: details.activeJobs.map((j) => ({
          id: j.id,
          title: j.title,
          company: j.company,
          location: j.rawLocation,
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
        company: null,
        activeJobs: [],
        error: error.message,
      };
    }
  },
});
