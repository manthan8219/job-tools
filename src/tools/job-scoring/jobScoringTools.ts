import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { JobScoringService } from "../../job-scoring/services/jobScoringService.js";
import {
  FitVerdictEnum,
  ScoreBreakdownSchema,
  StrongPointSchema,
  WeaknessSchema,
  MissingGapSchema,
  KeywordMatrixSchema,
  ActionableRecommendationSchema,
  JobUserScoreSchema,
} from "../../job-scoring/models/jobScoring.js";
import { withAuth } from "../../auth/middleware.js";

const scoringService = new JobScoringService();

/**
 * MCP Tool to save or update candidate match score and gap analysis for a job
 */
export const saveJobScoreTool = createTool({
  id: "save-job-score",
  description:
    "Saves or updates a candidate-job match analysis including overall score, fit verdict, score breakdown, strong points, weaknesses, gap analysis, keyword matrix, and actionable recommendations.",
  inputSchema: z.object({
    userId: z.string().uuid().optional().describe("UUID of the user. If omitted, defaults to authenticated user"),
    authUserId: z.string().optional(),
    jobId: z.string().uuid().describe("UUID of the job"),
    resumeId: z.string().optional().describe("Optional resume ID or version evaluated"),
    overall_score: z.number().min(0).max(100).describe("Overall match score percentage (0-100)"),
    fit_verdict: FitVerdictEnum.describe("Fit verdict: 'Strong Fit', 'Competitive Fit', 'Moderate Fit', or 'Stretch'"),
    score_breakdown: ScoreBreakdownSchema.describe("Detailed score breakdown across hard skills, experience, architecture, domain, and ATS"),
    strong_points: z.array(StrongPointSchema).default([]).describe("Key candidate strengths matching the role"),
    weaknesses: z.array(WeaknessSchema).default([]).describe("Key candidate weaknesses or concerns"),
    missing_gaps: z.array(MissingGapSchema).default([]).describe("Missing requirements and suggested actions"),
    keyword_matrix: KeywordMatrixSchema.describe("Matched, partial, and missing keywords"),
    actionable_recommendations: z.array(ActionableRecommendationSchema).default([]).describe("Specific resume revision, highlighting, and interview prep recommendations"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    score: JobUserScoreSchema.optional(),
    message: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: withAuth(async (input: any) => {
    try {
      const effectiveUserId = input.userId || input.authUserId;
      if (!effectiveUserId) {
        return { success: false, error: "Missing required userId" };
      }
      const saved = await scoringService.saveScore({ ...input, userId: effectiveUserId });
      return {
        success: true,
        score: saved,
        message: `Successfully saved score for user ${effectiveUserId} on job ${input.jobId} (${input.overall_score}%)`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }),
});

/**
 * MCP Tool to retrieve match score details for a specific user and job
 */
export const getJobScoreTool = createTool({
  id: "get-job-score",
  description:
    "Retrieves candidate match score, fit verdict, category score breakdown, gap analysis, keyword matrix, and recommendations for a specific user and job.",
  inputSchema: z.object({
    userId: z.string().uuid().optional().describe("UUID of the user. If omitted, defaults to authenticated user"),
    authUserId: z.string().optional(),
    jobId: z.string().uuid().describe("UUID of the job"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    score: JobUserScoreSchema.nullable().optional(),
    error: z.string().optional(),
    message: z.string().optional(),
  }),
  execute: withAuth(async (input: any) => {
    try {
      const effectiveUserId = input.userId || input.authUserId;
      if (!effectiveUserId) {
        return { success: false, score: null, error: "Missing required userId" };
      }
      const score = await scoringService.getScore(effectiveUserId, input.jobId);
      if (!score) {
        return {
          success: false,
          score: null,
          error: `Score not found for user ${effectiveUserId} and job ${input.jobId}`,
        };
      }
      return {
        success: true,
        score,
      };
    } catch (error: any) {
      return {
        success: false,
        score: null,
        error: error.message,
      };
    }
  }),
});

/**
 * MCP Tool to list top matching jobs for a user sorted by fit score
 */
export const getUserTopScoredJobsTool = createTool({
  id: "get-user-top-scored-jobs",
  description:
    "Lists a user's best matching jobs sorted by match score with fit verdicts, key summaries, and linked company and job details.",
  inputSchema: z.object({
    userId: z.string().uuid().optional().describe("UUID of the user. If omitted, defaults to authenticated user"),
    authUserId: z.string().optional(),
    minScore: z.number().min(0).max(100).optional().describe("Minimum overall score filter (e.g. 75)"),
    fitVerdict: FitVerdictEnum.optional().describe("Filter by fit verdict (e.g. 'Strong Fit')"),
    limit: z.number().int().positive().max(50).default(20).describe("Max results (default 20)"),
    offset: z.number().int().nonnegative().default(0).describe("Pagination offset"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    totalFound: z.number().optional(),
    returned: z.number().optional(),
    scores: z.array(
      z.object({
        id: z.string(),
        jobId: z.string(),
        jobTitle: z.string().optional(),
        companyName: z.string().optional(),
        companySlug: z.string().nullable().optional(),
        companyLogoUrl: z.string().nullable().optional(),
        locationName: z.string().nullable().optional(),
        workArrangement: z.string().nullable().optional(),
        employmentType: z.string().nullable().optional(),
        applyUrl: z.string().nullable().optional(),
        salaryMin: z.number().nullable().optional(),
        salaryMax: z.number().nullable().optional(),
        salaryCurrency: z.string().nullable().optional(),
        overallScore: z.number(),
        fitVerdict: z.string(),
        hardSkillsScore: z.number().optional(),
        experienceScore: z.number().optional(),
        scoreBreakdown: ScoreBreakdownSchema,
        keywordMatrix: KeywordMatrixSchema.optional(),
        createdAt: z.date().optional(),
        updatedAt: z.date().optional(),
      })
    ).optional(),
    error: z.string().optional(),
    message: z.string().optional(),
  }),
  execute: withAuth(async (input: any) => {
    try {
      const effectiveUserId = input.userId || input.authUserId;
      if (!effectiveUserId) {
        return { success: false, totalFound: 0, returned: 0, scores: [], error: "Missing required userId" };
      }
      const result = await scoringService.getUserTopScoredJobs({ ...input, userId: effectiveUserId });
      return {
        success: true,
        totalFound: result.totalFound,
        returned: result.scores.length,
        scores: result.scores,
      };
    } catch (error: any) {
      return {
        success: false,
        totalFound: 0,
        returned: 0,
        scores: [],
        error: error.message,
      };
    }
  }),
});
