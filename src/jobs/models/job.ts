import { z } from "zod";

export const EmploymentTypeEnum = z.enum([
  "full-time",
  "contract",
  "part-time",
  "internship",
  "temporary",
  "unknown",
]);

export const WorkArrangementEnum = z.enum([
  "remote",
  "hybrid",
  "on-site",
  "unknown",
]);

export const ExperienceLevelEnum = z.enum([
  "entry",
  "mid",
  "senior",
  "lead",
  "executive",
  "unknown",
]);

export const JobStatusEnum = z.enum([
  "active",
  "expired",
  "filled",
  "archived",
]);

export const JobSchema = z.object({
  id: z.string().uuid(),
  jobKey: z.string().min(16),
  externalId: z.string().min(1),
  source: z.string().min(1),
  title: z.string().min(1),
  company: z.string().min(1),
  companySlug: z.string().nullable().optional(),
  companyLogoUrl: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  excerpt: z.string().nullable().optional(),
  applyUrl: z.string().url(),
  applyType: z.enum(["url", "email", "ats"]).default("url"),
  applyEmail: z.string().email().nullable().optional(),
  employmentType: EmploymentTypeEnum.default("unknown"),
  workArrangement: WorkArrangementEnum.default("unknown"),
  experienceLevel: ExperienceLevelEnum.default("unknown"),
  categories: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  salaryMin: z.number().nullable().optional(),
  salaryMax: z.number().nullable().optional(),
  salaryCurrency: z.string().default("USD"),
  salaryPeriod: z.enum(["annual", "hourly", "monthly", "weekly", "fortnightly"]).default("annual"),
  primaryLocationId: z.string().uuid().nullable().optional(),
  companyId: z.string().uuid().nullable().optional(),
  rawLocation: z.string().nullable().optional(),
  isWorldwide: z.boolean().default(false),
  status: JobStatusEnum.default("active"),
  postedAt: z.coerce.date().nullable().optional(),
  lastSeenAt: z.coerce.date().default(() => new Date()),
  expiresAt: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date().default(() => new Date()),
  updatedAt: z.coerce.date().default(() => new Date()),
});

export type Job = z.infer<typeof JobSchema>;

export const CreateJobInputSchema = JobSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  id: z.string().uuid().optional(),
});

export type CreateJobInput = z.infer<typeof CreateJobInputSchema>;

export const JobFilterSchema = z.object({
  query: z.string().optional().describe("Free-text search across title, company, skills"),
  companySlug: z.string().optional().describe("Filter by company slug (e.g. 'ramp', 'gitlab')"),
  companyId: z.string().uuid().optional().describe("Filter by company ID"),
  countryCode: z.string().optional().describe("Filter by country ISO code (e.g. 'DE', 'CA', 'US')"),
  citySlug: z.string().optional().describe("Filter by city slug (e.g. 'munich', 'toronto')"),
  locationPathPrefix: z.string().optional().describe("Filter by location tree path prefix (e.g. 'world.europe.de')"),
  workArrangement: WorkArrangementEnum.optional().describe("remote, hybrid, on-site"),
  employmentType: EmploymentTypeEnum.optional(),
  experienceLevel: ExperienceLevelEnum.optional(),
  skills: z.array(z.string()).optional().describe("Match one or more tech skills"),
  salaryMin: z.number().optional(),
  source: z.string().optional(),
  status: JobStatusEnum.default("active").optional(),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
});

export type JobFilter = z.input<typeof JobFilterSchema>;

export interface JobSearchResult {
  jobs: (Job & {
    locationName?: string;
    locationPath?: string;
    countryCode?: string;
    companyWebsiteUrl?: string;
  })[];
  totalFound: number;
  limit: number;
  offset: number;
}
