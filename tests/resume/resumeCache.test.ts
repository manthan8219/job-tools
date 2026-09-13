import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ResumeCache } from "../../src/resume/cache/resumeCache.js";
import { getRedisClient } from "../../src/db/redis.js";

vi.mock("../../src/db/redis.js", () => ({
  getRedisClient: vi.fn(),
}));

describe("ResumeCache", () => {
  let cache: ResumeCache;
  let redisMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    cache = new ResumeCache();

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

  const mockResume = {
    id: "uuid-resume-1",
    userId: "uuid-user-1",
    title: "Senior Fullstack Engineer",
    skills: ["TypeScript", "Node.js", "Redis"],
    experience: [],
    education: [],
    createdAt: new Date("2026-09-13T00:00:00.000Z"),
    updatedAt: new Date("2026-09-13T00:00:00.000Z"),
  };

  it("should cache a resume by id, latest key, and invalidate user list", async () => {
    await cache.cacheResume(mockResume);

    expect(getRedisClient).toHaveBeenCalled();
    expect(redisMock.set).toHaveBeenCalledWith(
      `resume:${mockResume.id}`,
      expect.any(String),
      { EX: 86400 }
    );
    expect(redisMock.set).toHaveBeenCalledWith(
      `user:${mockResume.userId}:latest_resume`,
      expect.any(String),
      { EX: 86400 }
    );
    expect(redisMock.del).toHaveBeenCalledWith(`user:${mockResume.userId}:resumes`);
  });

  it("should return deserialized resume on getCachedResume hit", async () => {
    redisMock.get.mockResolvedValueOnce(JSON.stringify(mockResume));

    const result = await cache.getCachedResume(mockResume.id);
    expect(result).toBeDefined();
    expect(result?.id).toBe(mockResume.id);
    expect(result?.title).toBe(mockResume.title);
    expect(result?.createdAt).toBeInstanceOf(Date);
  });

  it("should return null on getCachedResume miss", async () => {
    redisMock.get.mockResolvedValueOnce(null);

    const result = await cache.getCachedResume("non-existent");
    expect(result).toBeNull();
  });

  it("should return cached user resumes list", async () => {
    redisMock.get.mockResolvedValueOnce(JSON.stringify([mockResume]));

    const result = await cache.getCachedUserResumes(mockResume.userId);
    expect(result).toHaveLength(1);
    expect(result?.[0].id).toBe(mockResume.id);
  });

  it("should cache user resumes list and prime individual resumes", async () => {
    await cache.cacheUserResumes(mockResume.userId, [mockResume]);

    expect(redisMock.set).toHaveBeenCalledWith(
      `user:${mockResume.userId}:resumes`,
      expect.any(String),
      { EX: 86400 }
    );
    expect(redisMock.set).toHaveBeenCalledWith(
      `resume:${mockResume.id}`,
      expect.any(String),
      { EX: 86400 }
    );
    expect(redisMock.set).toHaveBeenCalledWith(
      `user:${mockResume.userId}:latest_resume`,
      expect.any(String),
      { EX: 86400 }
    );
  });

  it("should invalidate resume keys on invalidateResume", async () => {
    await cache.invalidateResume(mockResume.id, mockResume.userId);

    expect(redisMock.del).toHaveBeenCalledWith(`resume:${mockResume.id}`);
    expect(redisMock.del).toHaveBeenCalledWith(`user:${mockResume.userId}:resumes`);
    expect(redisMock.del).toHaveBeenCalledWith(`user:${mockResume.userId}:latest_resume`);
  });

  it("should gracefully handle Redis errors without throwing", async () => {
    redisMock.get.mockRejectedValueOnce(new Error("Redis connection timed out"));

    const result = await cache.getCachedResume(mockResume.id);
    expect(result).toBeNull();
  });
});
