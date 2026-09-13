import { z } from "zod";

export const FitVerdictEnum = z.enum([
  "Strong Fit",
  "Competitive Fit",
  "Moderate Fit",
  "Stretch",
]);

export type FitVerdict = z.infer<typeof FitVerdictEnum>;

export const ScoreCategoryStatusEnum = z.enum([
  "strong",
  "moderate",
  "weak",
  "missing",
]);

export type ScoreCategoryStatus = z.infer<typeof ScoreCategoryStatusEnum>;

export const ScoreCategoryDetailSchema = z.object({
  score: z.number().min(0),
  max_score: z.number().positive(),
  status: ScoreCategoryStatusEnum,
  summary: z.string(),
});

export type ScoreCategoryDetail = z.infer<typeof ScoreCategoryDetailSchema>;

export const ScoreBreakdownSchema = z.object({
  hard_skills: ScoreCategoryDetailSchema,
  experience_and_seniority: ScoreCategoryDetailSchema,
  architecture_and_scale: ScoreCategoryDetailSchema,
  domain_and_industry: ScoreCategoryDetailSchema,
  ats_keyword_compatibility: ScoreCategoryDetailSchema,
});

export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;

export const StrongPointSchema = z.object({
  area: z.string(),
  detail: z.string(),
  evidence: z.string().optional(),
});

export type StrongPoint = z.infer<typeof StrongPointSchema>;

export const WeaknessSchema = z.object({
  area: z.string(),
  detail: z.string(),
  impact: z.string().optional(),
});

export type Weakness = z.infer<typeof WeaknessSchema>;

export const MissingGapSchema = z.object({
  requirement: z.string(),
  importance: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  suggested_action: z.string().optional(),
});

export type MissingGap = z.infer<typeof MissingGapSchema>;

export const KeywordMatrixSchema = z.object({
  matched: z.array(z.string()).default([]),
  partial: z.array(z.string()).default([]),
  missing: z.array(z.string()).default([]),
});

export type KeywordMatrix = z.infer<typeof KeywordMatrixSchema>;

export const ActionableRecommendationSchema = z.object({
  category: z.string(),
  target_section: z.string(),
  recommendation: z.string(),
});

export type ActionableRecommendation = z.infer<typeof ActionableRecommendationSchema>;

export const JobUserScoreSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  jobId: z.string().uuid(),
  resumeId: z.string().nullable().optional(),
  overallScore: z.number().min(0).max(100),
  fitVerdict: FitVerdictEnum,
  hardSkillsScore: z.number().optional(),
  experienceScore: z.number().optional(),
  architectureScore: z.number().optional(),
  domainScore: z.number().optional(),
  atsScore: z.number().optional(),
  scoreBreakdown: ScoreBreakdownSchema,
  strongPoints: z.array(StrongPointSchema).default([]),
  weaknesses: z.array(WeaknessSchema).default([]),
  missingGaps: z.array(MissingGapSchema).default([]),
  keywordMatrix: KeywordMatrixSchema,
  actionableRecommendations: z.array(ActionableRecommendationSchema).default([]),
  createdAt: z.coerce.date().default(() => new Date()),
  updatedAt: z.coerce.date().default(() => new Date()),
});

export type JobUserScore = z.infer<typeof JobUserScoreSchema>;

export const SaveJobUserScoreInputSchema = z.object({
  id: z.string().uuid().optional(),
  userId: z.string().uuid(),
  jobId: z.string().uuid(),
  resumeId: z.string().nullable().optional(),
  overall_score: z.number().min(0).max(100),
  fit_verdict: FitVerdictEnum,
  score_breakdown: ScoreBreakdownSchema,
  strong_points: z.array(StrongPointSchema).default([]),
  weaknesses: z.array(WeaknessSchema).default([]),
  missing_gaps: z.array(MissingGapSchema).default([]),
  keyword_matrix: KeywordMatrixSchema,
  actionable_recommendations: z.array(ActionableRecommendationSchema).default([]),
});

export type SaveJobUserScoreInput = z.infer<typeof SaveJobUserScoreInputSchema>;

export const JobUserScoreFilterSchema = z.object({
  userId: z.string().uuid(),
  minScore: z.number().min(0).max(100).optional(),
  fitVerdict: FitVerdictEnum.optional(),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
});

export type JobUserScoreFilter = z.input<typeof JobUserScoreFilterSchema>;

export interface ScoredJobWithDetails extends JobUserScore {
  jobTitle?: string;
  companyName?: string;
  companySlug?: string;
  companyLogoUrl?: string;
  locationName?: string;
  workArrangement?: string;
  employmentType?: string;
  applyUrl?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
}
