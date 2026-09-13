import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { JobScoringRepository } from "../../src/job-scoring/repositories/jobScoringRepository.js";
import { queryPostgres } from "../../src/db/index.js";
import { SaveJobUserScoreInput } from "../../src/job-scoring/models/jobScoring.js";

vi.mock("../../src/db/index.js", () => ({
  queryPostgres: vi.fn(),
}));

describe("JobScoringRepository", () => {
  let repository: JobScoringRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new JobScoringRepository();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const sampleInput: SaveJobUserScoreInput = {
    userId: "11111111-1111-1111-1111-111111111111",
    jobId: "22222222-2222-2222-2222-222222222222",
    overall_score: 82,
    fit_verdict: "Strong Fit",
    score_breakdown: {
      hard_skills: {
        score: 30,
        max_score: 35,
        status: "strong",
        summary: "Deep alignment with Java, Spring Boot, and PostgreSQL. Missing Terraform.",
      },
      experience_and_seniority: {
        score: 22,
        max_score: 25,
        status: "strong",
        summary: "5+ years backend engineering meets senior qualifications.",
      },
      architecture_and_scale: {
        score: 15,
        max_score: 20,
        status: "moderate",
        summary: "Proven microservices scale, but lacking explicit distributed consensus experience.",
      },
      domain_and_industry: {
        score: 8,
        max_score: 10,
        status: "strong",
        summary: "B2B SaaS platform experience aligns with target industry.",
      },
      ats_keyword_compatibility: {
        score: 7,
        max_score: 10,
        status: "moderate",
        summary: "Core keywords present; secondary tooling terms absent.",
      },
    },
    strong_points: [
      {
        area: "Core Backend & Microservices",
        detail: "Production mastery of Spring Boot and high-throughput event processing.",
        evidence: "Engineered event-driven microservices processing 15M+ requests/day.",
      },
    ],
    weaknesses: [
      {
        area: "Cloud Infrastructure Automation",
        detail: "JD emphasizes IaC with Terraform, but resume only mentions basic AWS console usage.",
        impact: "May raise questions during DevOps technical screen.",
      },
    ],
    missing_gaps: [
      {
        requirement: "Terraform / IaC",
        importance: "high",
        suggested_action: "Add specific IaC workflows or modules authored in prior roles.",
      },
      {
        requirement: "gRPC Service Contracts",
        importance: "medium",
        suggested_action: "Highlight gRPC APIs built in recent projects.",
      },
    ],
    keyword_matrix: {
      matched: ["Java", "Spring Boot", "Kubernetes", "PostgreSQL", "Docker", "AWS"],
      partial: ["Distributed Caching (Redis mentioned, but cache invalidation strategies omitted)"],
      missing: ["Terraform", "gRPC", "Prometheus", "Grafana"],
    },
    actionable_recommendations: [
      {
        category: "resume_revision",
        target_section: "Experience",
        recommendation: "Rewrite second bullet in current role using XYZ formula to emphasize high availability and latency reductions.",
      },
    ],
  };

  it("should initialize the job_user_scores table and indexes", async () => {
    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
      command: "CREATE",
      oid: 0,
      fields: [],
    });

    await repository.init();
    expect(queryPostgres).toHaveBeenCalledTimes(1);
    const sql = vi.mocked(queryPostgres).mock.calls[0][0];
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS job_user_scores");
    expect(sql).toContain("CONSTRAINT uq_job_user_score UNIQUE (user_id, job_id)");
  });

  it("should upsert a job user score and map row data", async () => {
    const mockRow = {
      id: "score-uuid-1",
      userId: sampleInput.userId,
      jobId: sampleInput.jobId,
      overallScore: "82.00",
      fitVerdict: "Strong Fit",
      hardSkillsScore: "30.00",
      experienceScore: "22.00",
      scoreBreakdown: sampleInput.score_breakdown,
      strongPoints: sampleInput.strong_points,
      weaknesses: sampleInput.weaknesses,
      missingGaps: sampleInput.missing_gaps,
      keywordMatrix: sampleInput.keyword_matrix,
      actionableRecommendations: sampleInput.actionable_recommendations,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [mockRow],
      rowCount: 1,
      command: "INSERT",
      oid: 0,
      fields: [],
    });

    const result = await repository.upsertScore(sampleInput);
    expect(result.overallScore).toBe(82);
    expect(result.fitVerdict).toBe("Strong Fit");
    expect(result.hardSkillsScore).toBe(30);
    expect(queryPostgres).toHaveBeenCalledTimes(1);
  });

  it("should find score by user and job id", async () => {
    const mockRow = {
      id: "score-uuid-1",
      userId: sampleInput.userId,
      jobId: sampleInput.jobId,
      overallScore: "82.00",
      fitVerdict: "Strong Fit",
      scoreBreakdown: sampleInput.score_breakdown,
    };

    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [mockRow],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    const found = await repository.findByUserAndJob(sampleInput.userId, sampleInput.jobId);
    expect(found).not.toBeNull();
    expect(found?.overallScore).toBe(82);
    expect(found?.fitVerdict).toBe("Strong Fit");
  });

  it("should list top scored jobs for a user with joined metadata", async () => {
    // Count query
    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [{ count: "1" }],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    // Data query
    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [
        {
          id: "score-1",
          userId: sampleInput.userId,
          jobId: sampleInput.jobId,
          overallScore: "85.00",
          fitVerdict: "Strong Fit",
          scoreBreakdown: sampleInput.score_breakdown,
          jobTitle: "Senior Backend Engineer",
          companyName: "GitLab",
          companySlug: "gitlab",
          applyUrl: "https://boards.greenhouse.io/gitlab/1",
        },
      ],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    const res = await repository.findUserTopScoredJobs({
      userId: sampleInput.userId,
      minScore: 80,
      fitVerdict: "Strong Fit",
    });

    expect(res.totalFound).toBe(1);
    expect(res.scores[0].overallScore).toBe(85);
    expect(res.scores[0].companyName).toBe("GitLab");
    expect(res.scores[0].jobTitle).toBe("Senior Backend Engineer");
  });

  it("should delete a score", async () => {
    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [],
      rowCount: 1,
      command: "DELETE",
      oid: 0,
      fields: [],
    });

    const deleted = await repository.deleteScore(sampleInput.userId, sampleInput.jobId);
    expect(deleted).toBe(true);
  });
});
