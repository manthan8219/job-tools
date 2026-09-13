import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { JobRepository } from "../../src/jobs/repositories/jobRepository.js";
import { queryPostgres } from "../../src/db/index.js";
import { CreateJobInput } from "../../src/jobs/models/job.js";

vi.mock("../../src/db/index.js", () => ({
  queryPostgres: vi.fn(),
}));

describe("JobRepository", () => {
  let repository: JobRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new JobRepository();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockJob = {
    id: "d3b07384-d113-40e1-954d-3d44bc149301",
    jobKey: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    externalId: "greenhouse-8646852002",
    source: "greenhouse",
    title: "Customer Success Architect, CEUR",
    company: "GitLab",
    companySlug: "gitlab",
    companyLogoUrl: null,
    description: "<p>Job Description</p>",
    excerpt: "Job Excerpt",
    applyUrl: "https://job-boards.greenhouse.io/gitlab/jobs/8646852002",
    applyType: "url",
    applyEmail: null,
    employmentType: "full-time",
    workArrangement: "remote",
    experienceLevel: "senior",
    categories: ["Engineering"],
    skills: ["PostgreSQL", "Linux"],
    salaryMin: 120000,
    salaryMax: 160000,
    salaryCurrency: "EUR",
    salaryPeriod: "annual",
    primaryLocationId: "loc-germany-uuid",
    rawLocation: "Remote, Germany",
    isWorldwide: false,
    status: "active",
    postedAt: new Date(),
    lastSeenAt: new Date(),
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("should initialize jobs and job_locations tables", async () => {
    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
      command: "CREATE",
      oid: 0,
      fields: [],
    });

    await repository.init();
    expect(queryPostgres).toHaveBeenCalledTimes(1);
    expect(vi.mocked(queryPostgres).mock.calls[0][0]).toContain("CREATE TABLE IF NOT EXISTS jobs");
  });

  it("should upsert a job successfully", async () => {
    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [mockJob],
      rowCount: 1,
      command: "INSERT",
      oid: 0,
      fields: [],
    });

    const input: CreateJobInput = {
      jobKey: mockJob.jobKey,
      externalId: mockJob.externalId,
      source: mockJob.source,
      title: mockJob.title,
      company: mockJob.company,
      applyUrl: mockJob.applyUrl,
      employmentType: "full-time",
      workArrangement: "remote",
      skills: ["PostgreSQL", "Linux"],
      categories: ["Engineering"],
    };

    const saved = await repository.upsertJob(input);
    expect(queryPostgres).toHaveBeenCalledTimes(1);
    expect(vi.mocked(queryPostgres).mock.calls[0][0]).toContain("ON CONFLICT (job_key) DO UPDATE");
    expect(saved.title).toBe(mockJob.title);
    expect(saved.company).toBe("GitLab");
  });

  it("should find jobs with filters and location tree path", async () => {
    // 1. Count query
    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [{ count: "1" }],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    // 2. Data query
    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [
        {
          ...mockJob,
          locationName: "Germany",
          locationPath: "world.europe.de",
          countryCode: "DE",
        },
      ],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    const results = await repository.findJobs({
      query: "Architect",
      countryCode: "DE",
      workArrangement: "remote",
      skills: ["PostgreSQL"],
      limit: 10,
    });

    expect(queryPostgres).toHaveBeenCalledTimes(2);
    expect(results.totalFound).toBe(1);
    expect(results.jobs).toHaveLength(1);
    expect(results.jobs[0].locationPath).toBe("world.europe.de");
  });

  it("should find job by id", async () => {
    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [mockJob],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    const job = await repository.findById(mockJob.id);
    expect(job?.id).toBe(mockJob.id);
  });
});
