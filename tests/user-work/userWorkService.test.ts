import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { UserWorkService } from "../../src/user-work/services/userWorkService.js";
import { NotFoundError } from "../../src/utils/index.js";

describe("UserWorkService", () => {
  let repoMock: any;
  let cacheMock: any;
  let service: UserWorkService;

  beforeEach(() => {
    vi.clearAllMocks();

    repoMock = {
      init: vi.fn().mockResolvedValue(undefined),
      upsert: vi.fn(),
      findById: vi.fn(),
      findByUserAndRepo: vi.fn(),
      findByUserId: vi.fn(),
      findFeatured: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
    };

    cacheMock = {
      cacheWork: vi.fn().mockResolvedValue(undefined),
      getCachedWorkById: vi.fn().mockResolvedValue(null),
      getCachedWorkByRepo: vi.fn().mockResolvedValue(null),
      getCachedWorkList: vi.fn().mockResolvedValue(null),
      cacheWorkList: vi.fn().mockResolvedValue(undefined),
      getCachedFeaturedWork: vi.fn().mockResolvedValue(null),
      cacheFeaturedWork: vi.fn().mockResolvedValue(undefined),
      invalidateWork: vi.fn().mockResolvedValue(undefined),
      hasCachedWork: vi.fn().mockResolvedValue(false),
    };

    service = new UserWorkService(repoMock, cacheMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockWork: any = {
    id: "work-1",
    userId: "11111111-1111-1111-1111-111111111111",
    repositoryName: "job-tools",
    tier: "flagship",
    isFeatured: true,
    totalCommits: 85,
  };

  it("should delegate init to repository", async () => {
    await service.init();
    expect(repoMock.init).toHaveBeenCalledTimes(1);
  });

  it("should save work to repository and cache in Redis", async () => {
    repoMock.upsert.mockResolvedValueOnce(mockWork);

    const input = {
      userId: "11111111-1111-1111-1111-111111111111",
      repositoryName: "job-tools",
      tier: "flagship" as const,
      isFeatured: true,
    };

    const result = await service.saveWork(input);

    expect(repoMock.upsert).toHaveBeenCalledWith(expect.objectContaining(input));
    expect(cacheMock.cacheWork).toHaveBeenCalledWith(mockWork);
    expect(result).toEqual(mockWork);
  });

  it("should return work from Redis cache on getWorkById hit", async () => {
    cacheMock.getCachedWorkById.mockResolvedValueOnce(mockWork);

    const result = await service.getWorkById("work-1", "11111111-1111-1111-1111-111111111111");

    expect(cacheMock.getCachedWorkById).toHaveBeenCalledWith("work-1");
    expect(repoMock.findById).not.toHaveBeenCalled();
    expect(result).toEqual(mockWork);
  });

  it("should query repository and cache in Redis on getWorkById miss", async () => {
    cacheMock.getCachedWorkById.mockResolvedValueOnce(null);
    repoMock.findById.mockResolvedValueOnce(mockWork);

    const result = await service.getWorkById("work-1", "11111111-1111-1111-1111-111111111111");

    expect(cacheMock.getCachedWorkById).toHaveBeenCalledWith("work-1");
    expect(repoMock.findById).toHaveBeenCalledWith("work-1");
    expect(cacheMock.cacheWork).toHaveBeenCalledWith(mockWork);
    expect(result).toEqual(mockWork);
  });

  it("should throw NotFoundError if work belongs to different user", async () => {
    cacheMock.getCachedWorkById.mockResolvedValueOnce(mockWork);

    await expect(service.getWorkById("work-1", "other-user")).rejects.toThrow(NotFoundError);
  });

  it("should return work by repo name using cache", async () => {
    cacheMock.getCachedWorkByRepo.mockResolvedValueOnce(mockWork);

    const result = await service.getWorkByRepo("11111111-1111-1111-1111-111111111111", "job-tools");
    expect(cacheMock.getCachedWorkByRepo).toHaveBeenCalledWith("11111111-1111-1111-1111-111111111111", "job-tools");
    expect(repoMock.findByUserAndRepo).not.toHaveBeenCalled();
    expect(result).toEqual(mockWork);
  });

  it("should return cached list on getUserWorkList without filters", async () => {
    cacheMock.getCachedWorkList.mockResolvedValueOnce([mockWork]);

    const result = await service.getUserWorkList({ userId: "11111111-1111-1111-1111-111111111111" });

    expect(cacheMock.getCachedWorkList).toHaveBeenCalledWith("11111111-1111-1111-1111-111111111111");
    expect(repoMock.findByUserId).not.toHaveBeenCalled();
    expect(result.repositories).toHaveLength(1);
  });

  it("should query repository and cache list on getUserWorkList cache miss", async () => {
    cacheMock.getCachedWorkList.mockResolvedValueOnce(null);
    repoMock.findByUserId.mockResolvedValueOnce({ repositories: [mockWork], totalFound: 1 });

    const result = await service.getUserWorkList({ userId: "11111111-1111-1111-1111-111111111111" });

    expect(repoMock.findByUserId).toHaveBeenCalled();
    expect(cacheMock.cacheWorkList).toHaveBeenCalledWith("11111111-1111-1111-1111-111111111111", [mockWork]);
    expect(result.repositories).toHaveLength(1);
  });

  it("should retrieve featured work using cache", async () => {
    cacheMock.getCachedFeaturedWork.mockResolvedValueOnce([mockWork]);

    const result = await service.getFeaturedWork("11111111-1111-1111-1111-111111111111");
    expect(cacheMock.getCachedFeaturedWork).toHaveBeenCalledWith("11111111-1111-1111-1111-111111111111");
    expect(repoMock.findFeatured).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it("should delete work and invalidate cache", async () => {
    repoMock.delete.mockResolvedValueOnce(true);

    const deleted = await service.deleteWork("11111111-1111-1111-1111-111111111111", "work-1");
    expect(deleted).toBe(true);
    expect(cacheMock.invalidateWork).toHaveBeenCalledWith("work-1", "11111111-1111-1111-1111-111111111111", "work-1");
  });

  describe("isRepositoryScraped", () => {
    it("should return true when found in Redis cache", async () => {
      cacheMock.hasCachedWork = vi.fn().mockResolvedValueOnce(true);

      const scraped = await service.isRepositoryScraped("work-1", "11111111-1111-1111-1111-111111111111");
      expect(scraped).toBe(true);
      expect(cacheMock.hasCachedWork).toHaveBeenCalledWith("work-1", "11111111-1111-1111-1111-111111111111");
      expect(repoMock.exists).not.toHaveBeenCalled();
    });

    it("should check database when not in cache and return true if exists", async () => {
      cacheMock.hasCachedWork = vi.fn().mockResolvedValueOnce(false);
      repoMock.exists = vi.fn().mockResolvedValueOnce(true);

      const scraped = await service.isRepositoryScraped("job-tools", "11111111-1111-1111-1111-111111111111");
      expect(scraped).toBe(true);
      expect(repoMock.exists).toHaveBeenCalledWith("job-tools", "11111111-1111-1111-1111-111111111111");
    });

    it("should return false when neither in cache nor in database", async () => {
      cacheMock.hasCachedWork = vi.fn().mockResolvedValueOnce(false);
      repoMock.exists = vi.fn().mockResolvedValueOnce(false);

      const scraped = await service.isRepositoryScraped("unscraped-repo", "11111111-1111-1111-1111-111111111111");
      expect(scraped).toBe(false);
    });
  });
});
