import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { UserWorkCache } from "../../src/user-work/cache/userWorkCache.js";
import { getRedisClient } from "../../src/db/redis.js";

vi.mock("../../src/db/redis.js", () => ({
  getRedisClient: vi.fn(),
}));

describe("UserWorkCache", () => {
  let cache: UserWorkCache;
  let redisMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    cache = new UserWorkCache();

    redisMock = {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue("OK"),
      del: vi.fn().mockResolvedValue(1),
    };

    vi.mocked(getRedisClient).mockResolvedValue(redisMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockWork = {
    id: "work-uuid-1",
    userId: "user-uuid-1",
    repositoryName: "job-tools",
    tier: "flagship" as const,
    isFeatured: true,
    displayOrder: 0,
    isFork: false,
    isPrivate: false,
    starsCount: 10,
    forksCount: 2,
    primaryBranch: "main",
    primaryLanguages: ["TypeScript"],
    technologiesDetected: {},
    totalActiveDays: 30,
    totalCommits: 50,
    linesAdded: 5000,
    linesDeleted: 1000,
    filesModified: 20,
    timeline: {},
    commitsSummary: {},
    workDescription: {},
    bulletPoints: [],
    mostEffectiveWorkList: [],
    createdAt: new Date("2026-09-13T00:00:00.000Z"),
    updatedAt: new Date("2026-09-13T00:00:00.000Z"),
  };

  it("should cache a work item and invalidate list and featured keys", async () => {
    await cache.cacheWork(mockWork);

    expect(getRedisClient).toHaveBeenCalled();
    expect(redisMock.set).toHaveBeenCalledWith(
      `user_work:${mockWork.id}`,
      expect.any(String),
      { EX: 86400 }
    );
    expect(redisMock.set).toHaveBeenCalledWith(
      `user:${mockWork.userId}:work:repo:job-tools`,
      expect.any(String),
      { EX: 86400 }
    );
    expect(redisMock.del).toHaveBeenCalledWith(`user:${mockWork.userId}:work:list`);
    expect(redisMock.del).toHaveBeenCalledWith(`user:${mockWork.userId}:work:featured`);
  });

  it("should return deserialized work on getCachedWorkById hit", async () => {
    redisMock.get.mockResolvedValueOnce(JSON.stringify(mockWork));

    const result = await cache.getCachedWorkById(mockWork.id);
    expect(result).toBeDefined();
    expect(result?.id).toBe(mockWork.id);
    expect(result?.repositoryName).toBe(mockWork.repositoryName);
  });

  it("should return null on getCachedWorkById miss", async () => {
    redisMock.get.mockResolvedValueOnce(null);

    const result = await cache.getCachedWorkById("missing-id");
    expect(result).toBeNull();
  });

  it("should return cached work by user and repo name", async () => {
    redisMock.get.mockResolvedValueOnce(JSON.stringify(mockWork));

    const result = await cache.getCachedWorkByRepo(mockWork.userId, "job-tools");
    expect(result).toBeDefined();
    expect(result?.repositoryName).toBe("job-tools");
  });

  it("should cache and retrieve work list", async () => {
    await cache.cacheWorkList(mockWork.userId, [mockWork]);

    expect(redisMock.set).toHaveBeenCalledWith(
      `user:${mockWork.userId}:work:list`,
      expect.any(String),
      { EX: 86400 }
    );

    redisMock.get.mockResolvedValueOnce(JSON.stringify([mockWork]));
    const list = await cache.getCachedWorkList(mockWork.userId);
    expect(list).toHaveLength(1);
    expect(list?.[0].id).toBe(mockWork.id);
  });

  it("should cache and retrieve featured work list", async () => {
    await cache.cacheFeaturedWork(mockWork.userId, [mockWork]);

    expect(redisMock.set).toHaveBeenCalledWith(
      `user:${mockWork.userId}:work:featured`,
      expect.any(String),
      { EX: 86400 }
    );

    redisMock.get.mockResolvedValueOnce(JSON.stringify([mockWork]));
    const featured = await cache.getCachedFeaturedWork(mockWork.userId);
    expect(featured).toHaveLength(1);
  });

  it("should gracefully handle Redis errors without throwing", async () => {
    redisMock.get.mockRejectedValueOnce(new Error("Connection error"));

    const result = await cache.getCachedWorkById(mockWork.id);
    expect(result).toBeNull();
  });

  it("should check if work is cached using exists", async () => {
    redisMock.exists = vi.fn().mockResolvedValueOnce(1);

    const exists = await cache.hasCachedWork("work-uuid-1");
    expect(exists).toBe(true);
    expect(redisMock.exists).toHaveBeenCalledWith("user_work:work-uuid-1");
  });

  it("should return false if work is not in cache", async () => {
    redisMock.exists = vi.fn().mockResolvedValueOnce(0);

    const exists = await cache.hasCachedWork("work-uuid-1");
    expect(exists).toBe(false);
  });
});
