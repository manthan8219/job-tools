import { z } from "zod";

export const AtsTypeEnum = z.enum([
  "greenhouse",
  "ashby",
  "lever",
  "workday",
  "custom",
  "other",
]);

export type AtsType = z.infer<typeof AtsTypeEnum>;

export const CompanySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  websiteUrl: z.string().url().nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  linkedinUrl: z.string().url().nullable().optional(),
  linkedinId: z.string().nullable().optional(), // e.g. "gitlab-com", "stripe"
  description: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  sizeRange: z.string().nullable().optional(), // e.g. "11-50", "201-500", "1000+"
  headquartersLocationId: z.string().uuid().nullable().optional(),
  atsType: AtsTypeEnum.nullable().optional(),
  atsBoardToken: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.coerce.date().default(() => new Date()),
  updatedAt: z.coerce.date().default(() => new Date()),
});

export type Company = z.infer<typeof CompanySchema>;

export const CreateCompanyInputSchema = CompanySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  id: z.string().uuid().optional(),
});

export type CreateCompanyInput = z.infer<typeof CreateCompanyInputSchema>;

export const CompanyAtsTypeEnum = AtsTypeEnum;

export const CompanyFilterSchema = z.object({
  query: z.string().optional().describe("Search by company name, industry, or description"),
  industry: z.string().optional(),
  atsType: AtsTypeEnum.optional(),
  linkedinId: z.string().optional().describe("Filter by LinkedIn company handle or ID"),
  isActive: z.boolean().default(true).optional(),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
});

export type CompanyFilter = z.input<typeof CompanyFilterSchema>;

export interface CompanyWithJobStats extends Company {
  activeJobsCount: number;
}

export const INITIAL_COMPANIES_SEED: CreateCompanyInput[] = [
  {
    name: "GitLab",
    slug: "gitlab",
    websiteUrl: "https://about.gitlab.com",
    linkedinUrl: "https://www.linkedin.com/company/gitlab-com",
    linkedinId: "gitlab-com",
    industry: "DevSecOps",
    sizeRange: "1000+",
    atsType: "greenhouse",
    atsBoardToken: "gitlab",
    description: "The intelligent orchestration platform for DevSecOps.",
    isActive: true,
  },
  {
    name: "Stripe",
    slug: "stripe",
    websiteUrl: "https://stripe.com",
    linkedinUrl: "https://www.linkedin.com/company/stripe",
    linkedinId: "stripe",
    industry: "Fintech",
    sizeRange: "1000+",
    atsType: "greenhouse",
    atsBoardToken: "stripe",
    description: "Financial infrastructure for the internet.",
    isActive: true,
  },
  {
    name: "Celonis",
    slug: "celonis",
    websiteUrl: "https://www.celonis.com",
    linkedinUrl: "https://www.linkedin.com/company/celonis",
    linkedinId: "celonis",
    industry: "Enterprise Software / AI",
    sizeRange: "1000+",
    atsType: "greenhouse",
    atsBoardToken: "celonis",
    description: "The global leader in Process Mining and Process Intelligence.",
    isActive: true,
  },
  {
    name: "N26",
    slug: "n26",
    websiteUrl: "https://n26.com",
    linkedinUrl: "https://www.linkedin.com/company/n26",
    linkedinId: "n26",
    industry: "Fintech / Banking",
    sizeRange: "1000+",
    atsType: "greenhouse",
    atsBoardToken: "n26",
    description: "The mobile bank helping millions manage their money on the go.",
    isActive: true,
  },
  {
    name: "Datadog",
    slug: "datadog",
    websiteUrl: "https://www.datadoghq.com",
    linkedinUrl: "https://www.linkedin.com/company/datadog",
    linkedinId: "datadog",
    industry: "Cloud Monitoring & Observability",
    sizeRange: "1000+",
    atsType: "greenhouse",
    atsBoardToken: "datadog",
    description: "Monitoring and security platform for cloud applications.",
    isActive: true,
  },
  {
    name: "Ramp",
    slug: "ramp",
    websiteUrl: "https://ramp.com",
    linkedinUrl: "https://www.linkedin.com/company/ramp-card",
    linkedinId: "ramp-card",
    industry: "Fintech",
    sizeRange: "501-1000",
    atsType: "ashby",
    atsBoardToken: "ramp",
    description: "The smart corporate card and spend management platform.",
    isActive: true,
  },
  {
    name: "Notion",
    slug: "notion",
    websiteUrl: "https://notion.so",
    linkedinUrl: "https://www.linkedin.com/company/notionhq",
    linkedinId: "notionhq",
    industry: "Productivity / Collaboration",
    sizeRange: "501-1000",
    atsType: "ashby",
    atsBoardToken: "notion",
    description: "The connected workspace where better, faster work happens.",
    isActive: true,
  },
  {
    name: "Linear",
    slug: "linear",
    websiteUrl: "https://linear.app",
    linkedinUrl: "https://www.linkedin.com/company/linear-app",
    linkedinId: "linear-app",
    industry: "Developer Tools",
    sizeRange: "51-200",
    atsType: "ashby",
    atsBoardToken: "linear",
    description: "The issue tracking tool built for high-performance product teams.",
    isActive: true,
  },
  {
    name: "1Password",
    slug: "1password",
    websiteUrl: "https://1password.com",
    linkedinUrl: "https://www.linkedin.com/company/1password",
    linkedinId: "1password",
    industry: "Cybersecurity",
    sizeRange: "501-1000",
    atsType: "ashby",
    atsBoardToken: "1password",
    description: "Password manager and identity access platform.",
    isActive: true,
  },
  {
    name: "Wealthsimple",
    slug: "wealthsimple",
    websiteUrl: "https://www.wealthsimple.com",
    linkedinUrl: "https://www.linkedin.com/company/wealthsimple",
    linkedinId: "wealthsimple",
    industry: "Fintech",
    sizeRange: "1000+",
    atsType: "ashby",
    atsBoardToken: "wealthsimple",
    description: "Financial services platform for investing, saving, and spending.",
    isActive: true,
  },
  {
    name: "Palantir",
    slug: "palantir",
    websiteUrl: "https://www.palantir.com",
    linkedinUrl: "https://www.linkedin.com/company/palantir-technologies",
    linkedinId: "palantir-technologies",
    industry: "Enterprise AI & Big Data",
    sizeRange: "1000+",
    atsType: "lever",
    atsBoardToken: "palantir",
    description: "Foundational software platforms for enterprise operations and data analytics.",
    isActive: true,
  },
];
