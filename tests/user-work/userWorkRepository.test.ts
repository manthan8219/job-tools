import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { UserWorkPostgresRepository } from "../../src/user-work/repositories/userWorkRepository.js";
import { queryPostgres } from "../../src/db/index.js";
import { SaveUserWorkInput } from "../../src/user-work/models/userWork.js";

vi.mock("../../src/db/index.js", () => ({
  queryPostgres: vi.fn(),
}));

describe("UserWorkPostgresRepository", () => {
  let repository: UserWorkPostgresRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new UserWorkPostgresRepository();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const sampleInput: SaveUserWorkInput = {
    userId: "11111111-1111-1111-1111-111111111111",
    repositoryName: "job-tools",
    fullName: "manthan8219/job-tools",
    remoteUrl: "https://github.com/manthan8219/job-tools",
    tier: "flagship",
    isFeatured: true,
    primaryLanguage: "TypeScript",
    primaryLanguages: ["TypeScript", "SQL"],
    technologiesDetected: {
      frameworks: ["Express", "Mastra"],
      databases: ["PostgreSQL", "Redis", "MongoDB"],
      infrastructure_and_cloud: ["Docker", "Render"],
      libraries_and_tools: ["Zod", "Vitest"],
    },
    totalCommits: 85,
    linesAdded: 15400,
    linesDeleted: 2100,
    filesModified: 45,
    workDescription: {
      system_overview: "MCP server suite for career automation.",
      role_and_ownership: "Lead architect who implemented caching and database layers.",
      technical_challenges_solved: "Resolved latency and concurrency issues.",
    },
    bulletPoints: [
      "Engineered multi-model MCP server supporting 20+ specialized tools.",
    ],
    mostEffectiveWorkList: [
      {
        title: "Redis Sub-millisecond Cache",
        description: "Implemented two-tier write-through cache.",
        impact: "Reduced query times by 90%.",
      },
    ],
  };

  it("should initialize the user_repositories table and indexes", async () => {
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
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS user_repositories");
    expect(sql).toContain("CONSTRAINT uq_user_repository UNIQUE (user_id, repository_name)");
  });

  it("should upsert a user work repository and map row data", async () => {
    const mockRow = {
      id: "repo-uuid-1",
      userId: sampleInput.userId,
      repositoryName: sampleInput.repositoryName,
      fullName: sampleInput.fullName,
      remoteUrl: sampleInput.remoteUrl,
      tier: "flagship",
      isFeatured: true,
      displayOrder: 0,
      isFork: false,
      isPrivate: false,
      starsCount: 5,
      forksCount: 1,
      primaryLanguage: "TypeScript",
      primaryLanguages: ["TypeScript", "SQL"],
      technologiesDetected: sampleInput.technologiesDetected,
      totalCommits: 85,
      linesAdded: 15400,
      linesDeleted: 2100,
      filesModified: 45,
      workDescription: sampleInput.workDescription,
      bulletPoints: sampleInput.bulletPoints,
      mostEffectiveWorkList: sampleInput.mostEffectiveWorkList,
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

    const result = await repository.upsert(sampleInput);
    expect(result.id).toBe("repo-uuid-1");
    expect(result.repositoryName).toBe("job-tools");
    expect(result.tier).toBe("flagship");
    expect(result.isFeatured).toBe(true);
    expect(result.totalCommits).toBe(85);
    expect(queryPostgres).toHaveBeenCalledTimes(1);
  });

  it("should find repository by id", async () => {
    const mockRow = {
      id: "repo-uuid-1",
      userId: sampleInput.userId,
      repositoryName: "job-tools",
      tier: "flagship",
    };

    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [mockRow],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    const found = await repository.findById("repo-uuid-1");
    expect(found).not.toBeNull();
    expect(found?.id).toBe("repo-uuid-1");
    expect(found?.repositoryName).toBe("job-tools");
  });

  it("should find repository by user and repository name", async () => {
    const mockRow = {
      id: "repo-uuid-1",
      userId: sampleInput.userId,
      repositoryName: "job-tools",
      tier: "flagship",
    };

    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [mockRow],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    const found = await repository.findByUserAndRepo(sampleInput.userId, "job-tools");
    expect(found).not.toBeNull();
    expect(found?.repositoryName).toBe("job-tools");
  });

  it("should list repositories for a user with count", async () => {
    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [{ count: "1" }],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [
        {
          id: "repo-1",
          userId: sampleInput.userId,
          repositoryName: "job-tools",
          tier: "flagship",
          isFeatured: true,
        },
      ],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    const res = await repository.findByUserId({
      userId: sampleInput.userId,
      isFeatured: true,
    });

    expect(res.totalFound).toBe(1);
    expect(res.repositories).toHaveLength(1);
    expect(res.repositories[0].repositoryName).toBe("job-tools");
  });

  it("should delete a repository", async () => {
    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [],
      rowCount: 1,
      command: "DELETE",
      oid: 0,
      fields: [],
    });

    const deleted = await repository.delete(sampleInput.userId, "job-tools");
    expect(deleted).toBe(true);
  });

  it("should check if repository exists by UUID", async () => {
    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [{ '?column?': 1 }],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    const exists = await repository.exists("a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d", sampleInput.userId);
    expect(exists).toBe(true);
  });

  it("should check if repository exists by repository name", async () => {
    vi.mocked(queryPostgres).mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    const exists = await repository.exists("non-existent-repo", sampleInput.userId);
    expect(exists).toBe(false);
  });
});
