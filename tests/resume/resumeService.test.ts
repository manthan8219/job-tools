import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ResumeService } from "../../src/resume/services/resumeService.js";
import { NotFoundError } from "../../src/utils/index.js";

describe("ResumeService", () => {
  let repoMock: any;
  let cacheMock: any;
  let service: ResumeService;

  beforeEach(() => {
    vi.clearAllMocks();

    repoMock = {
      create: vi.fn(),
      findById: vi.fn(),
      findByUserId: vi.fn(),
      findSimilarResumes: vi.fn(),
    };

    cacheMock = {
      cacheResume: vi.fn().mockResolvedValue(undefined),
      getCachedResume: vi.fn().mockResolvedValue(null),
      getCachedUserResumes: vi.fn().mockResolvedValue(null),
      cacheUserResumes: vi.fn().mockResolvedValue(undefined),
      getCachedLatestResume: vi.fn().mockResolvedValue(null),
      cacheLatestResume: vi.fn().mockResolvedValue(undefined),
      invalidateResume: vi.fn().mockResolvedValue(undefined),
    };

    service = new ResumeService(repoMock, cacheMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockResume = {
    id: "uuid-1234",
    userId: "user-abcd",
    title: "Software Engineer",
    skills: ["TypeScript"],
    experience: [],
    education: [],
    embedding: [0.1, 0.2, 0.3],
    createdAt: new Date("2026-09-13T00:00:00.000Z"),
    updatedAt: new Date("2026-09-13T00:00:00.000Z"),
  } as any;

  describe("createResume", () => {
    it("should validate input, persist to repository, and cache in Redis", async () => {
      repoMock.create.mockResolvedValueOnce(mockResume);

      const input = {
        title: "Software Engineer",
        skills: ["TypeScript"],
        experience: [],
        education: [],
        embedding: [0.1, 0.2, 0.3],
      };

      const result = await service.createResume(mockResume.userId, input);

      expect(repoMock.create).toHaveBeenCalledWith(mockResume.userId, input);
      expect(cacheMock.cacheResume).toHaveBeenCalledWith(mockResume);
      expect(result).toEqual(mockResume);
    });

    it("should throw Zod error for invalid input", async () => {
      const input = { skills: ["TypeScript"], experience: [], education: [] };
      await expect(service.createResume(mockResume.userId, input)).rejects.toThrow();
      expect(repoMock.create).not.toHaveBeenCalled();
      expect(cacheMock.cacheResume).not.toHaveBeenCalled();
    });
  });

  describe("getResume", () => {
    it("should return resume from Redis cache on cache hit without calling repository", async () => {
      cacheMock.getCachedResume.mockResolvedValueOnce(mockResume);

      const result = await service.getResume(mockResume.id, mockResume.userId);

      expect(cacheMock.getCachedResume).toHaveBeenCalledWith(mockResume.id);
      expect(repoMock.findById).not.toHaveBeenCalled();
      expect(result).toEqual(mockResume);
    });

    it("should query repository and populate Redis cache on cache miss", async () => {
      cacheMock.getCachedResume.mockResolvedValueOnce(null);
      repoMock.findById.mockResolvedValueOnce(mockResume);

      const result = await service.getResume(mockResume.id, mockResume.userId);

      expect(cacheMock.getCachedResume).toHaveBeenCalledWith(mockResume.id);
      expect(repoMock.findById).toHaveBeenCalledWith(mockResume.id);
      expect(cacheMock.cacheResume).toHaveBeenCalledWith(mockResume);
      expect(result).toEqual(mockResume);
    });

    it("should throw NotFoundError if cached resume belongs to a different user", async () => {
      cacheMock.getCachedResume.mockResolvedValueOnce(mockResume);

      await expect(service.getResume(mockResume.id, "different-user")).rejects.toThrow(NotFoundError);
    });

    it("should throw NotFoundError if repository resume belongs to a different user", async () => {
      cacheMock.getCachedResume.mockResolvedValueOnce(null);
      repoMock.findById.mockResolvedValueOnce(mockResume);

      await expect(service.getResume(mockResume.id, "different-user")).rejects.toThrow(NotFoundError);
    });

    it("should throw NotFoundError if resume does not exist", async () => {
      cacheMock.getCachedResume.mockResolvedValueOnce(null);
      repoMock.findById.mockResolvedValueOnce(null);

      await expect(service.getResume("bad-id", mockResume.userId)).rejects.toThrow(NotFoundError);
    });
  });

  describe("getUserResumes", () => {
    it("should return user resumes from Redis cache on cache hit", async () => {
      cacheMock.getCachedUserResumes.mockResolvedValueOnce([mockResume]);

      const result = await service.getUserResumes(mockResume.userId);

      expect(cacheMock.getCachedUserResumes).toHaveBeenCalledWith(mockResume.userId);
      expect(repoMock.findByUserId).not.toHaveBeenCalled();
      expect(result).toEqual([mockResume]);
    });

    it("should query repository and cache resumes on cache miss", async () => {
      cacheMock.getCachedUserResumes.mockResolvedValueOnce(null);
      repoMock.findByUserId.mockResolvedValueOnce([mockResume]);

      const result = await service.getUserResumes(mockResume.userId);

      expect(repoMock.findByUserId).toHaveBeenCalledWith(mockResume.userId);
      expect(cacheMock.cacheUserResumes).toHaveBeenCalledWith(mockResume.userId, [mockResume]);
      expect(result).toEqual([mockResume]);
    });
  });

  describe("getLatestResume", () => {
    it("should return latest resume from Redis cache on cache hit", async () => {
      cacheMock.getCachedLatestResume.mockResolvedValueOnce(mockResume);

      const result = await service.getLatestResume(mockResume.userId);

      expect(cacheMock.getCachedLatestResume).toHaveBeenCalledWith(mockResume.userId);
      expect(result).toEqual(mockResume);
    });

    it("should retrieve user resumes and cache latest on cache miss", async () => {
      cacheMock.getCachedLatestResume.mockResolvedValueOnce(null);
      cacheMock.getCachedUserResumes.mockResolvedValueOnce([mockResume]);

      const result = await service.getLatestResume(mockResume.userId);

      expect(cacheMock.cacheLatestResume).toHaveBeenCalledWith(mockResume.userId, mockResume);
      expect(result).toEqual(mockResume);
    });
  });

  describe("searchSimilarResumes", () => {
    it("should enforce vector presence and call repository", async () => {
      const queryVector = [0.9, 0.8, 0.7];
      repoMock.findSimilarResumes.mockResolvedValueOnce([mockResume]);

      const result = await service.searchSimilarResumes(mockResume.userId, queryVector, 3);
      
      expect(repoMock.findSimilarResumes).toHaveBeenCalledWith(mockResume.userId, queryVector, 3);
      expect(result).toEqual([mockResume]);
    });

    it("should throw an error if query vector is empty", async () => {
      await expect(service.searchSimilarResumes(mockResume.userId, [])).rejects.toThrow("Invalid query vector");
    });
  });
});
