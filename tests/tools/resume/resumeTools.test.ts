import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createResumeTool,
  getResumeTool,
  getUserResumesTool,
  getLatestResumeTool,
  searchSimilarResumesTool,
} from "../../../src/tools/resume/resumeTools.js";
import { resumeService } from "../../../src/resume/services/resumeService.js";

// Note: withAuth middleware injects authUserId: "user-1234-5678"
vi.mock("../../../src/resume/services/resumeService.js", () => ({
  resumeService: {
    createResume: vi.fn(),
    getResume: vi.fn(),
    getUserResumes: vi.fn(),
    getLatestResume: vi.fn(),
    searchSimilarResumes: vi.fn(),
  },
}));

describe("Resume MCP Tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockResume = {
    id: "uuid-1234",
    title: "Engineer",
    userId: "user-1234-5678",
  } as any;

  describe("createResumeTool", () => {
    it("should successfully create a resume", async () => {
      vi.mocked(resumeService.createResume).mockResolvedValueOnce(mockResume);

      const input = {
        title: "Engineer",
        skills: ["TS"],
        experience: [],
        education: [],
      };

      const result = await createResumeTool.execute(input);

      expect(resumeService.createResume).toHaveBeenCalledWith("user-1234-5678", expect.objectContaining(input));
      expect(result.success).toBe(true);
      expect((result as any).resume).toEqual(mockResume);
    });
  });

  describe("getResumeTool", () => {
    it("should successfully retrieve resume by ID", async () => {
      vi.mocked(resumeService.getResume).mockResolvedValueOnce(mockResume);

      const result = await getResumeTool.execute({ id: mockResume.id });

      expect(resumeService.getResume).toHaveBeenCalledWith(mockResume.id, "user-1234-5678");
      expect(result.success).toBe(true);
      expect((result as any).resume).toEqual(mockResume);
    });

    it("should return failure when resume not found", async () => {
      vi.mocked(resumeService.getResume).mockRejectedValueOnce(new Error("Resume not found"));

      const result = await getResumeTool.execute({ id: "missing-id" });

      expect(result.success).toBe(false);
      expect((result as any).message).toContain("Resume not found");
    });
  });

  describe("getUserResumesTool", () => {
    it("should return user resumes list", async () => {
      vi.mocked(resumeService.getUserResumes).mockResolvedValueOnce([mockResume]);

      const result = await getUserResumesTool.execute({});

      expect(resumeService.getUserResumes).toHaveBeenCalledWith("user-1234-5678");
      expect(result.success).toBe(true);
      expect((result as any).totalFound).toBe(1);
      expect((result as any).resumes).toHaveLength(1);
    });
  });

  describe("getLatestResumeTool", () => {
    it("should return user's latest resume", async () => {
      vi.mocked(resumeService.getLatestResume).mockResolvedValueOnce(mockResume);

      const result = await getLatestResumeTool.execute({});

      expect(resumeService.getLatestResume).toHaveBeenCalledWith("user-1234-5678");
      expect(result.success).toBe(true);
      expect((result as any).resume).toEqual(mockResume);
    });

    it("should handle when no resumes exist for user", async () => {
      vi.mocked(resumeService.getLatestResume).mockResolvedValueOnce(null);

      const result = await getLatestResumeTool.execute({});

      expect(result.success).toBe(false);
      expect((result as any).message).toContain("No resumes found");
    });
  });

  describe("searchSimilarResumesTool", () => {
    it("should execute semantic search and return matches", async () => {
      vi.mocked(resumeService.searchSimilarResumes).mockResolvedValueOnce([{ ...mockResume, score: 0.99 }]);

      const input = {
        jobEmbedding: [0.1, 0.2, 0.3],
      };

      const result = await searchSimilarResumesTool.execute(input);

      expect(resumeService.searchSimilarResumes).toHaveBeenCalledWith("user-1234-5678", input.jobEmbedding);
      expect(result.success).toBe(true);
      expect((result as any).matches).toHaveLength(1);
    });
  });
});
