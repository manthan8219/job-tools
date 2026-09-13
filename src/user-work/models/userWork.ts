import { z } from "zod";

export const TechnologiesDetectedSchema = z.object({
  frameworks: z.array(z.string()).default([]),
  databases: z.array(z.string()).default([]),
  infrastructure_and_cloud: z.array(z.string()).default([]),
  libraries_and_tools: z.array(z.string()).default([]),
});

export type TechnologiesDetected = z.infer<typeof TechnologiesDetectedSchema>;

export const TimelineSchema = z.object({
  duration_formatted: z.string().optional(),
  first_commit_date: z.string().optional(),
  latest_commit_date: z.string().optional(),
  total_active_days: z.number().int().nonnegative().default(0),
});

export type Timeline = z.infer<typeof TimelineSchema>;

export const CommitsSummarySchema = z.object({
  total_commits: z.number().int().nonnegative().default(0),
  lines_added: z.number().int().nonnegative().default(0),
  lines_deleted: z.number().int().nonnegative().default(0),
  files_modified: z.number().int().nonnegative().default(0),
  key_modules_touched: z.array(z.string()).default([]),
  top_files_authored_or_modified: z.array(z.string()).default([]),
});

export type CommitsSummary = z.infer<typeof CommitsSummarySchema>;

export const MostEffectiveWorkItemSchema = z.object({
  title: z.string(),
  description: z.string(),
  impact: z.string().optional(),
});

export type MostEffectiveWorkItem = z.infer<typeof MostEffectiveWorkItemSchema>;

export const WorkDescriptionSchema = z.object({
  system_overview: z.string().optional(),
  role_and_ownership: z.string().optional(),
  technical_challenges_solved: z.string().optional(),
});

export type WorkDescription = z.infer<typeof WorkDescriptionSchema>;

export const TierEnum = z.enum(["flagship", "contributing", "spike"]);
export type Tier = z.infer<typeof TierEnum>;

export const UserWorkRepositorySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  repositoryName: z.string(),
  fullName: z.string().nullable().optional(),
  remoteUrl: z.string().nullable().optional(),
  localPath: z.string().nullable().optional(),
  primaryBranch: z.string().default("main"),
  tier: TierEnum.default("contributing"),
  isFeatured: z.boolean().default(false),
  displayOrder: z.number().int().default(0),
  isFork: z.boolean().default(false),
  isPrivate: z.boolean().default(false),
  starsCount: z.number().int().default(0),
  forksCount: z.number().int().default(0),
  primaryLanguage: z.string().nullable().optional(),
  primaryLanguages: z.array(z.string()).default([]),
  technologiesDetected: TechnologiesDetectedSchema.default({}),
  firstCommitDate: z.date().nullable().optional(),
  latestCommitDate: z.date().nullable().optional(),
  totalActiveDays: z.number().int().default(0),
  totalCommits: z.number().int().default(0),
  linesAdded: z.number().int().default(0),
  linesDeleted: z.number().int().default(0),
  filesModified: z.number().int().default(0),
  timeline: TimelineSchema.default({}),
  commitsSummary: CommitsSummarySchema.default({}),
  workDescription: WorkDescriptionSchema.default({}),
  bulletPoints: z.array(z.string()).default([]),
  mostEffectiveWorkList: z.array(MostEffectiveWorkItemSchema).default([]),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type UserWorkRepository = z.infer<typeof UserWorkRepositorySchema>;

export const SaveUserWorkInputSchema = z.object({
  id: z.string().uuid().optional(),
  userId: z.string().uuid(),
  repositoryName: z.string().min(1, "Repository name is required"),
  fullName: z.string().optional(),
  remoteUrl: z.string().optional(),
  localPath: z.string().optional(),
  primaryBranch: z.string().default("main").optional(),
  tier: TierEnum.default("contributing").optional(),
  isFeatured: z.boolean().default(false).optional(),
  displayOrder: z.number().int().default(0).optional(),
  isFork: z.boolean().default(false).optional(),
  isPrivate: z.boolean().default(false).optional(),
  starsCount: z.number().int().default(0).optional(),
  forksCount: z.number().int().default(0).optional(),
  primaryLanguage: z.string().optional(),
  primaryLanguages: z.array(z.string()).default([]).optional(),
  technologiesDetected: TechnologiesDetectedSchema.default({}).optional(),
  firstCommitDate: z.coerce.date().optional(),
  latestCommitDate: z.coerce.date().optional(),
  totalActiveDays: z.number().int().default(0).optional(),
  totalCommits: z.number().int().default(0).optional(),
  linesAdded: z.number().int().default(0).optional(),
  linesDeleted: z.number().int().default(0).optional(),
  filesModified: z.number().int().default(0).optional(),
  timeline: TimelineSchema.default({}).optional(),
  commitsSummary: CommitsSummarySchema.default({}).optional(),
  workDescription: WorkDescriptionSchema.default({}).optional(),
  bulletPoints: z.array(z.string()).default([]).optional(),
  mostEffectiveWorkList: z.array(MostEffectiveWorkItemSchema).default([]).optional(),
});

export type SaveUserWorkInput = z.infer<typeof SaveUserWorkInputSchema>;

export const UserWorkFilterSchema = z.object({
  userId: z.string().uuid(),
  tier: TierEnum.optional(),
  isFeatured: z.boolean().optional(),
  primaryLanguage: z.string().optional(),
  limit: z.number().int().positive().max(100).default(50).optional(),
  offset: z.number().int().nonnegative().default(0).optional(),
});

export type UserWorkFilter = z.infer<typeof UserWorkFilterSchema>;
