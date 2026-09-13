import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { JobScoringService } from "../../src/job-scoring/services/jobScoringService.js";

describe("JobScoringService", () => {
  let repoMock: any;
  let service: JobScoringService;

  beforeEach(() => {
    vi.clearAllMocks();

    repoMock = {
      init: vi.fn().mockResolvedValue(undefined),
      upsertScore: vi.fn(),
      findByUserAndJob: vi.fn(),
      findUserTopScoredJobs: vi.fn(),
      deleteScore: vi.fn(),
    };

    service = new JobScoringService(repoMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should delegate init to repository", async () => {
    await service.init();
    expect(repoMock.init).toHaveBeenCalledTimes(1);
  });

  it("should delegate saveScore to repository", async () => {
    const mockScore: any = {
      id: "score-1",
      userId: "u1",
      jobId: "j1",
      overallScore: 82,
      fitVerdict: "Strong Fit",
    };

    repoMock.upsertScore.mockResolvedValueOnce(mockScore);

    const result = await service.saveScore({
      userId: "u1",
      jobId: "j1",
      overall_score: 82,
      fit_verdict: "Strong Fit",
      score_breakdown: {} as any,
      strong_points: [],
      weaknesses: [],
      missing_gaps: [],
      keyword_matrix: { matched: [], partial: [], missing: [] },
      actionable_recommendations: [],
    });

    expect(result.overallScore).toBe(82);
    expect(repoMock.upsertScore).toHaveBeenCalledTimes(1);
  });

  it("should delegate getScore to repository", async () => {
    repoMock.findByUserAndJob.mockResolvedValueOnce({
      id: "score-1",
      userId: "u1",
      jobId: "j1",
      overallScore: 88,
    });

    const result = await service.getScore("u1", "j1");
    expect(result?.overallScore).toBe(88);
    expect(repoMock.findByUserAndJob).toHaveBeenCalledWith("u1", "j1");
  });

  it("should delegate getUserTopScoredJobs to repository", async () => {
    repoMock.findUserTopScoredJobs.mockResolvedValueOnce({
      scores: [
        {
          id: "score-1",
          userId: "u1",
          jobId: "j1",
          overallScore: 92,
        },
      ],
      totalFound: 1,
    });

    const result = await service.getUserTopScoredJobs({ userId: "u1", minScore: 90 });
    expect(result.totalFound).toBe(1);
    expect(result.scores[0].overallScore).toBe(92);
  });

  it("should delegate deleteScore to repository", async () => {
    repoMock.deleteScore.mockResolvedValueOnce(true);
    const res = await service.deleteScore("u1", "j1");
    expect(res).toBe(true);
  });
});
