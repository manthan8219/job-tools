import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  saveJobScoreTool,
  getJobScoreTool,
  getUserTopScoredJobsTool,
} from "../../../src/tools/job-scoring/jobScoringTools.js";
import { queryPostgres } from "../../../src/db/index.js";

vi.mock("../../../src/db/index.js", () => ({
  queryPostgres: vi.fn(),
}));

describe("Job Scoring MCP Tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const userId = "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d";
  const jobId = "c1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d";

  const sampleBreakdown = {
    hard_skills: { score: 30, max_score: 35, status: "strong" as const, summary: "Deep alignment with Java and PostgreSQL." },
    experience_and_seniority: { score: 22, max_score: 25, status: "strong" as const, summary: "5+ years backend meets requirements." },
    architecture_and_scale: { score: 15, max_score: 20, status: "moderate" as const, summary: "Scale proven, lacking consensus." },
    domain_and_industry: { score: 8, max_score: 10, status: "strong" as const, summary: "B2B SaaS platform experience." },
    ats_keyword_compatibility: { score: 7, max_score: 10, status: "moderate" as const, summary: "80% coverage on core terms." },
  };

  const sampleStrongPoints = [
    { area: "Backend Systems", detail: "Deep Java knowledge", evidence: "Led architecture at previous role" },
  ];

  const sampleWeaknesses = [
    { area: "Infrastructure", detail: "No direct Terraform experience", impact: "Minor onboarding ramp required" },
  ];

  const sampleMissingGaps = [
    { requirement: "Terraform", importance: "high" as const, suggested_action: "Complete quick IaC certification/module" },
  ];

  const sampleKeywordMatrix = {
    matched: ["Java", "Spring Boot", "PostgreSQL"],
    partial: ["AWS"],
    missing: ["Terraform"],
  };

  const sampleRecommendations = [
    {
      category: "Resume Highlight",
      target_section: "Professional Experience",
      recommendation: "Emphasize cloud automation work",
    },
  ];

  // DB Row format matching SQL query alias: user_id AS "userId", overall_score AS "overallScore", etc.
  const mockDbScoreRow = {
    id: "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e",
    userId,
    jobId,
    resumeId: "res-1",
    overallScore: "82.00",
    fitVerdict: "Strong Fit",
    hardSkillsScore: "30.00",
    experienceScore: "22.00",
    architectureScore: "15.00",
    domainScore: "8.00",
    atsScore: "7.00",
    scoreBreakdown: sampleBreakdown,
    strongPoints: sampleStrongPoints,
    weaknesses: sampleWeaknesses,
    missingGaps: sampleMissingGaps,
    keywordMatrix: sampleKeywordMatrix,
    actionableRecommendations: sampleRecommendations,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe("saveJobScoreTool", () => {
    it("should successfully save job score", async () => {
      vi.mocked(queryPostgres).mockResolvedValueOnce({
        rows: [mockDbScoreRow],
        rowCount: 1,
        command: "INSERT",
        oid: 0,
        fields: [],
      });

      const result = await saveJobScoreTool.execute({
        userId,
        jobId,
        resumeId: "res-1",
        overall_score: 82,
        fit_verdict: "Strong Fit",
        score_breakdown: sampleBreakdown,
        strong_points: sampleStrongPoints,
        weaknesses: sampleWeaknesses,
        missing_gaps: sampleMissingGaps,
        keyword_matrix: sampleKeywordMatrix,
        actionable_recommendations: sampleRecommendations,
      });

      expect(result.success).toBe(true);
      expect(result.score).toBeDefined();
      expect(result.score?.overallScore).toBe(82);
      expect(result.score?.fitVerdict).toBe("Strong Fit");
      expect(result.message).toContain("82%");
    });

    it("should handle error when database fails", async () => {
      vi.mocked(queryPostgres).mockRejectedValueOnce(new Error("DB connection error"));

      const result = await saveJobScoreTool.execute({
        userId,
        jobId,
        overall_score: 82,
        fit_verdict: "Strong Fit",
        score_breakdown: sampleBreakdown,
        strong_points: [],
        weaknesses: [],
        missing_gaps: [],
        keyword_matrix: { matched: [], partial: [], missing: [] },
        actionable_recommendations: [],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("DB connection error");
    });
  });

  describe("getJobScoreTool", () => {
    it("should retrieve existing score for user and job", async () => {
      vi.mocked(queryPostgres).mockResolvedValueOnce({
        rows: [mockDbScoreRow],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const result = await getJobScoreTool.execute({
        userId,
        jobId,
      });

      expect(result.success).toBe(true);
      expect(result.score?.overallScore).toBe(82);
      expect(result.score?.fitVerdict).toBe("Strong Fit");
    });

    it("should return not found error when score does not exist", async () => {
      vi.mocked(queryPostgres).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const result = await getJobScoreTool.execute({
        userId,
        jobId,
      });

      expect(result.success).toBe(false);
      expect(result.score).toBeNull();
      expect(result.error).toContain("not found");
    });
  });

  describe("getUserTopScoredJobsTool", () => {
    it("should return top scored jobs for user", async () => {
      // 1. Count query
      vi.mocked(queryPostgres).mockResolvedValueOnce({
        rows: [{ count: "1" }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      // 2. Data query
      const mockJoinedRow = {
        ...mockDbScoreRow,
        jobTitle: "Senior Backend Engineer",
        companyName: "Stripe",
        companySlug: "stripe",
        companyLogoUrl: "https://stripe.com/logo.png",
        locationName: "San Francisco, CA",
        workArrangement: "remote",
        employmentType: "full-time",
        applyUrl: "https://stripe.com/jobs/123",
        salaryMin: 160000,
        salaryMax: 210000,
        salaryCurrency: "USD",
      };

      vi.mocked(queryPostgres).mockResolvedValueOnce({
        rows: [mockJoinedRow],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const result = await getUserTopScoredJobsTool.execute({
        userId,
        minScore: 80,
      });

      expect(result.success).toBe(true);
      expect(result.totalFound).toBe(1);
      expect(result.returned).toBe(1);
      expect(result.scores[0].overallScore).toBe(82);
      expect(result.scores[0].jobTitle).toBe("Senior Backend Engineer");
      expect(result.scores[0].companyName).toBe("Stripe");
    });

    it("should handle error in top scored jobs query", async () => {
      vi.mocked(queryPostgres).mockRejectedValueOnce(new Error("Query failed"));

      const result = await getUserTopScoredJobsTool.execute({
        userId,
      });

      expect(result.success).toBe(false);
      expect(result.totalFound).toBe(0);
      expect(result.scores).toHaveLength(0);
      expect(result.error).toContain("Query failed");
    });
  });
});
