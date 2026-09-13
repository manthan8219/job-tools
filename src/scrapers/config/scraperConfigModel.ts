import { z } from "zod";

export const SupportedTitleSchema = z.object({
  title: z.string().min(1).describe("Standardized display job title"),
  slug: z.string().min(1).describe("Normalized URL/search friendly slug"),
  category: z.string().default("Engineering").describe("Industry or functional department"),
  aliases: z.array(z.string()).default([]).describe("Common search terms, synonyms, and variations"),
  enabled: z.boolean().default(true).describe("Whether this title is actively supported for scraping"),
});

export type SupportedTitle = z.infer<typeof SupportedTitleSchema>;

export const SupportedCountrySchema = z.object({
  code: z.string().min(2).max(10).describe("ISO alpha-2 code or special identifier like GLOBAL"),
  name: z.string().min(1).describe("Country or region display name"),
  aliases: z.array(z.string()).default([]).describe("Cities, state codes, localized names, or synonyms"),
  enabled: z.boolean().default(true).describe("Whether this country is actively supported for scraping"),
});

export type SupportedCountry = z.infer<typeof SupportedCountrySchema>;

export const SupportedSourceSchema = z.object({
  source: z.string().min(1).describe("Internal source identifier (e.g., 'greenhouse', 'ashby')"),
  name: z.string().min(1).describe("Display name of the platform"),
  enabled: z.boolean().default(true).describe("Whether this source is currently active"),
  rateLimitPerMin: z.number().int().positive().optional(),
});

export type SupportedSource = z.infer<typeof SupportedSourceSchema>;

export const ScraperConfigSchema = z.object({
  id: z.string().default("default").describe("Unique configuration identifier"),
  version: z.number().int().positive().default(1).describe("Schema version for future migrations"),
  description: z.string().optional().describe("Description or notes for this scraper configuration"),
  supportedTitles: z.array(SupportedTitleSchema).default([]),
  supportedCountries: z.array(SupportedCountrySchema).default([]),
  supportedSources: z.array(SupportedSourceSchema).default([]),
  settings: z.record(z.unknown()).default({}).describe("Extensible global flags and options"),
  createdAt: z.coerce.date().default(() => new Date()),
  updatedAt: z.coerce.date().default(() => new Date()),
});

export type ScraperConfig = z.infer<typeof ScraperConfigSchema>;

export const DEFAULT_SCRAPER_CONFIG: Omit<ScraperConfig, "createdAt" | "updatedAt"> = {
  id: "default",
  version: 1,
  description: "Global job scraping configuration defining supported roles, target countries, and active sources",
  supportedTitles: [
    {
      title: "Software Engineer",
      slug: "software-engineer",
      category: "Engineering",
      aliases: ["software developer", "swe", "software programmer", "application developer"],
      enabled: true,
    },
    {
      title: "Backend Engineer",
      slug: "backend-engineer",
      category: "Engineering",
      aliases: ["backend developer", "back end engineer", "node.js developer", "go developer", "python developer", "java developer"],
      enabled: true,
    },
    {
      title: "Frontend Engineer",
      slug: "frontend-engineer",
      category: "Engineering",
      aliases: ["frontend developer", "front end engineer", "react developer", "ui engineer", "web developer"],
      enabled: true,
    },
    {
      title: "Full Stack Engineer",
      slug: "full-stack-engineer",
      category: "Engineering",
      aliases: ["full stack developer", "fullstack engineer", "fullstack developer"],
      enabled: true,
    },
    {
      title: "DevOps Engineer",
      slug: "devops-engineer",
      category: "Infrastructure",
      aliases: ["site reliability engineer", "sre", "platform engineer", "cloud engineer", "infrastructure engineer"],
      enabled: true,
    },
    {
      title: "Data Engineer",
      slug: "data-engineer",
      category: "Data",
      aliases: ["big data engineer", "analytics engineer", "data infrastructure engineer"],
      enabled: true,
    },
    {
      title: "AI / Machine Learning Engineer",
      slug: "ai-ml-engineer",
      category: "AI",
      aliases: ["machine learning engineer", "ml engineer", "ai engineer", "deep learning engineer", "llm engineer"],
      enabled: true,
    },
    {
      title: "Product Manager",
      slug: "product-manager",
      category: "Product",
      aliases: ["pm", "technical product manager", "associate product manager"],
      enabled: true,
    },
  ],
  supportedCountries: [
    {
      code: "DE",
      name: "Germany",
      aliases: ["germany", "de", "deutschland", "berlin", "munich", "frankfurt", "hamburg", "cologne"],
      enabled: true,
    },
    {
      code: "CA",
      name: "Canada",
      aliases: ["canada", "ca", "toronto", "vancouver", "montreal", "ottawa", "calgary", "waterloo", "ontario", "british columbia", "alberta"],
      enabled: true,
    },
    {
      code: "US",
      name: "United States",
      aliases: ["usa", "us", "united states", "america", "san francisco", "new york", "nyc", "austin", "seattle", "boston", "chicago"],
      enabled: true,
    },
    {
      code: "GB",
      name: "United Kingdom",
      aliases: ["uk", "gb", "united kingdom", "britain", "england", "scotland", "london", "manchester", "edinburgh", "cambridge"],
      enabled: true,
    },
    {
      code: "IN",
      name: "India",
      aliases: ["india", "in", "bangalore", "bengaluru", "hyderabad", "mumbai", "pune", "delhi", "noida", "gurgaon"],
      enabled: true,
    },
    {
      code: "CH",
      name: "Switzerland",
      aliases: ["switzerland", "ch", "zurich", "geneva", "lausanne", "basel"],
      enabled: true,
    },
    {
      code: "NL",
      name: "Netherlands",
      aliases: ["netherlands", "holland", "nl", "amsterdam", "rotterdam", "utrecht", "eindhoven"],
      enabled: true,
    },
    {
      code: "GLOBAL",
      name: "Worldwide / Remote",
      aliases: ["worldwide", "anywhere", "global", "remote", "everywhere"],
      enabled: true,
    },
  ],
  supportedSources: [
    { source: "himalayas", name: "Himalayas Remote Jobs", enabled: true },
    { source: "greenhouse", name: "Greenhouse ATS", enabled: true },
    { source: "ashby", name: "Ashby HQ ATS", enabled: true },
    { source: "lever", name: "Lever ATS", enabled: true },
    { source: "jobicy", name: "Jobicy Remote Jobs", enabled: true },
    { source: "remotive", name: "Remotive Remote Jobs", enabled: true },
    { source: "remoteok", name: "RemoteOK Remote Jobs", enabled: true },
    { source: "hackernews", name: "Hacker News Hiring", enabled: true },
  ],
  settings: {
    defaultLimit: 20,
    maxLimit: 50,
    autoDeduplication: true,
    cronEnabled: true,
  },
};
