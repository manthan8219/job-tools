import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resumeService } from "../../src/resume/services/resumeService.js";
import { resumeRepository } from "../../src/resume/repositories/resumeRepository.js";
import { NotFoundError } from "../../src/utils/index.js";

vi.mock("../../src/resume/repositories/resumeRepository.js", () => ({
  resumeRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    findByUserId: vi.fn(),
    findSimilarResumes: vi.fn(),
  },
}));

describe("ResumeService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  } as any;

  describe("createResume", () => {
    it("should validate input and call repository", async () => {
      vi.mocked(resumeRepository.create).mockResolvedValueOnce(mockResume);

      const input = {
        title: "Software Engineer",
        skills: ["TypeScript"],
        experience: [],
        education: [],
        embedding: [0.1, 0.2, 0.3],
      };

      const result = await resumeService.createResume(mockResume.userId, input);

      expect(resumeRepository.create).toHaveBeenCalledWith(mockResume.userId, input);
      expect(result).toEqual(mockResume);
    });

    it("should throw Zod error for invalid input", async () => {
      // Missing title
      const input = { skills: ["TypeScript"], experience: [], education: [] };
      await expect(resumeService.createResume(mockResume.userId, input)).rejects.toThrow();
    });
  });

  describe("getResume", () => {
    it("should return resume if it exists and belongs to the user", async () => {
      vi.mocked(resumeRepository.findById).mockResolvedValueOnce(mockResume);

      const result = await resumeService.getResume(mockResume.id, mockResume.userId);
      expect(result).toEqual(mockResume);
    });

    it("should throw NotFoundError if resume belongs to a different user", async () => {
      vi.mocked(resumeRepository.findById).mockResolvedValueOnce(mockResume);

      await expect(resumeService.getResume(mockResume.id, "different-user")).rejects.toThrow(NotFoundError);
    });

    it("should throw NotFoundError if resume does not exist", async () => {
      vi.mocked(resumeRepository.findById).mockResolvedValueOnce(null);

      await expect(resumeService.getResume("bad-id", mockResume.userId)).rejects.toThrow(NotFoundError);
    });
  });

  describe("searchSimilarResumes", () => {
    it("should enforce vector presence and call repository", async () => {
      const queryVector = [0.9, 0.8, 0.7];
      vi.mocked(resumeRepository.findSimilarResumes).mockResolvedValueOnce([mockResume]);

      const result = await resumeService.searchSimilarResumes(mockResume.userId, queryVector, 3);
      
      expect(resumeRepository.findSimilarResumes).toHaveBeenCalledWith(mockResume.userId, queryVector, 3);
      expect(result).toEqual([mockResume]);
    });

    it("should throw an error if query vector is empty", async () => {
      await expect(resumeService.searchSimilarResumes(mockResume.userId, [])).rejects.toThrow("Invalid query vector");
    });
  });
});
