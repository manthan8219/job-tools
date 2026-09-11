import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createResumeTool, searchSimilarResumesTool } from "../../../src/tools/resume/resumeTools.js";
import { resumeService } from "../../../src/resume/services/resumeService.js";

// Note: withAuth middleware is automatically executed but uses the dummy injection
vi.mock("../../../src/resume/services/resumeService.js", () => ({
  resumeService: {
    createResume: vi.fn(),
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

      // The withAuth middleware injects authUserId: "user-1234-5678"
      expect(resumeService.createResume).toHaveBeenCalledWith("user-1234-5678", expect.objectContaining(input));
      expect(result.success).toBe(true);
      expect((result as any).resume).toEqual(mockResume);
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
