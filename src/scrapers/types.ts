import { z } from "zod";

// ==========================================
// UNIFIED SCRAPER DOMAIN TYPES
// ==========================================

export const ScrapedJobSchema = z.object({
  id: z.string().describe("Unique identifier or source-scoped job ID"),
  title: z.string(),
  company: z.string(),
  location: z.string().optional(),
  description: z.string().optional(),
  excerpt: z.string().optional(),
  url: z.string().url(),
  source: z.string().describe("Source platform, e.g. 'himalayas', 'greenhouse', 'lever'"),
  employmentType: z.enum(["full-time", "contract", "part-time", "internship", "temporary", "unknown"]).default("unknown"),
  workArrangement: z.enum(["remote", "hybrid", "on-site", "unknown"]).default("unknown"),
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
  salaryCurrency: z.string().default("USD").optional(),
  salaryPeriod: z.enum(["hourly", "weekly", "fortnightly", "monthly", "annual"]).default("annual").optional(),
  categories: z.array(z.string()).default([]).optional(),
  postedAt: z.date().optional(),
  expiresAt: z.date().optional(),
  scrapedAt: z.date().default(() => new Date()),
  rawData: z.record(z.unknown()).optional().describe("Raw platform-specific payload"),
});

export type ScrapedJob = z.infer<typeof ScrapedJobSchema>;

export const ScrapeQuerySchema = z.object({
  query: z.string().optional().describe("Free-text job search query"),
  titles: z.array(z.string()).optional(),
  country: z.string().optional().describe("Country filter (ISO alpha-2 or name)"),
  worldwideOnly: z.boolean().optional(),
  seniority: z.array(z.enum(["Entry-level", "Mid-level", "Senior", "Manager", "Director", "Executive"])).optional(),
  employmentType: z.array(z.enum(["Full Time", "Part Time", "Contractor", "Temporary", "Intern", "Volunteer", "Other"])).optional(),
  limit: z.number().int().positive().max(50).default(20).optional(),
  page: z.number().int().positive().default(1).optional(),
  cursor: z.string().optional().describe("Cursor pointer for feed pagination"),
  maxPages: z.number().int().positive().default(1).optional().describe("Max pages to auto-paginate through (default 1)"),
  delayMs: z.number().int().nonnegative().default(500).optional().describe("Delay between consecutive page requests in ms"),
});

export type ScrapeQuery = z.infer<typeof ScrapeQuerySchema>;


export const ScrapeResultSchema = z.object({
  source: z.string(),
  jobs: z.array(ScrapedJobSchema),
  totalFound: z.number().int().nonnegative(),
  nextCursor: z.string().optional(),
  nextPage: z.number().int().positive().optional(),
  currentPage: z.number().int().positive().optional(),
  totalPages: z.number().int().positive().optional(),
  pagesFetched: z.number().int().positive().default(1),
  hasMore: z.boolean().default(false),
  fetchedAt: z.date(),
  error: z.string().optional(),
});

export type ScrapeResult = z.infer<typeof ScrapeResultSchema>;


// ==========================================
// HIMALAYAS API SPECIFIC SCHEMAS (OpenAPI 3.1.0)
// ==========================================

export const HimalayasLocationSchema = z.union([
  z.object({
    alpha2: z.string().optional(),
    name: z.string().optional(),
    slug: z.string().optional(),
  }),
  z.string(),
]);
export type HimalayasLocation = z.infer<typeof HimalayasLocationSchema>;

export const HimalayasJobSchema = z.object({
  title: z.string(),
  excerpt: z.string().optional(),
  companyName: z.string(),
  companySlug: z.string().optional(),
  companyLogo: z.string().nullable().optional(),
  employmentType: z.string().optional(),
  minSalary: z.number().nullable().optional(),
  maxSalary: z.number().nullable().optional(),
  seniority: z.array(z.string()).default([]),
  currency: z.string().nullable().optional(),
  salaryPeriod: z.enum(["hourly", "weekly", "fortnightly", "monthly", "annual"]).default("annual"),
  locationRestrictions: z.array(HimalayasLocationSchema).default([]),
  timezoneRestrictions: z.array(z.union([z.string(), z.number()])).default([]),
  categories: z.array(z.string()).default([]),
  parentCategories: z.array(z.string()).default([]),
  description: z.string().optional(),
  pubDate: z.number().optional().describe("Unix timestamp in milliseconds"),
  expiryDate: z.number().optional().describe("Unix timestamp in milliseconds"),
  applicationLink: z.string(),
  guid: z.string(),
});
export type HimalayasJob = z.infer<typeof HimalayasJobSchema>;

export const HimalayasJobsResponseSchema = z.object({
  comments: z.string().optional(),
  updatedAt: z.number().optional(),
  nextCursor: z.string().optional(),
  offset: z.number().optional().default(0),
  limit: z.number().optional().default(20),
  totalCount: z.number().optional().default(0),
  jobs: z.array(HimalayasJobSchema),
});
export type HimalayasJobsResponse = z.infer<typeof HimalayasJobsResponseSchema>;
