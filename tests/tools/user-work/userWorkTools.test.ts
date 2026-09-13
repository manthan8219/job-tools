import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  saveUserWorkTool,
  getUserWorkTool,
  getUserWorkListTool,
  getFeaturedUserWorkTool,
} from "../../../src/tools/user-work/userWorkTools.js";
import { userWorkService } from "../../../src/user-work/services/userWorkService.js";

// withAuth middleware injects authUserId: "user-1234-5678"
vi.mock("../../../src/user-work/services/userWorkService.js", () => ({
  userWorkService: {
    saveWork: vi.fn(),
    getWorkById: vi.fn(),
    getWorkByRepo: vi.fn(),
    getUserWorkList: vi.fn(),
    getFeaturedWork: vi.fn(),
  },
}));

describe("User Work MCP Tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockWork = {
    id: "work-uuid-1234",
    userId: "user-1234-5678",
    repositoryName: "job-tools",
    fullName: "manthan8219/job-tools",
    tier: "flagship",
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
    bulletPoints: ["Engineered MCP server."],
    mostEffectiveWorkList: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  describe("saveUserWorkTool", () => {
    it("should successfully save user work", async () => {
      vi.mocked(userWorkService.saveWork).mockResolvedValueOnce(mockWork);

      const input = {
        repositoryName: "job-tools",
        tier: "flagship" as const,
        isFeatured: true,
      };

      const result = await saveUserWorkTool.execute(input);

      expect(userWorkService.saveWork).toHaveBeenCalledWith(
        expect.objectContaining({
          repositoryName: "job-tools",
          userId: "user-1234-5678",
        })
      );
      expect(result.success).toBe(true);
      expect(result.work).toEqual(mockWork);
    });

    it("should handle service error gracefully", async () => {
      vi.mocked(userWorkService.saveWork).mockRejectedValueOnce(new Error("Database error"));

      const result = await saveUserWorkTool.execute({
        repositoryName: "job-tools",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Database error");
    });
  });

  describe("getUserWorkTool", () => {
    it("should retrieve work by repo name", async () => {
      vi.mocked(userWorkService.getWorkByRepo).mockResolvedValueOnce(mockWork);

      const result = await getUserWorkTool.execute({
        idOrName: "job-tools",
      });

      expect(userWorkService.getWorkByRepo).toHaveBeenCalledWith("user-1234-5678", "job-tools");
      expect(result.success).toBe(true);
      expect(result.work?.repositoryName).toBe("job-tools");
    });

    it("should retrieve work by UUID", async () => {
      vi.mocked(userWorkService.getWorkById).mockResolvedValueOnce(mockWork);

      const uuid = "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d";
      const result = await getUserWorkTool.execute({
        idOrName: uuid,
      });

      expect(userWorkService.getWorkById).toHaveBeenCalledWith(uuid, "user-1234-5678");
      expect(result.success).toBe(true);
    });

    it("should handle not found result", async () => {
      vi.mocked(userWorkService.getWorkByRepo).mockResolvedValueOnce(null);

      const result = await getUserWorkTool.execute({
        idOrName: "unknown-repo",
      });

      expect(result.success).toBe(false);
      expect(result.work).toBeNull();
      expect(result.message).toContain("not found");
    });
  });

  describe("getUserWorkListTool", () => {
    it("should return repositories list", async () => {
      vi.mocked(userWorkService.getUserWorkList).mockResolvedValueOnce({
        repositories: [mockWork],
        totalFound: 1,
      });

      const result = await getUserWorkListTool.execute({
        tier: "flagship",
      });

      expect(userWorkService.getUserWorkList).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1234-5678",
          tier: "flagship",
        })
      );
      expect(result.success).toBe(true);
      expect(result.totalFound).toBe(1);
      expect(result.repositories).toHaveLength(1);
    });
  });

  describe("getFeaturedUserWorkTool", () => {
    it("should return featured work projects", async () => {
      vi.mocked(userWorkService.getFeaturedWork).mockResolvedValueOnce([mockWork]);

      const result = await getFeaturedUserWorkTool.execute({});

      expect(userWorkService.getFeaturedWork).toHaveBeenCalledWith("user-1234-5678");
      expect(result.success).toBe(true);
      expect(result.totalFound).toBe(1);
      expect(result.featuredProjects).toHaveLength(1);
    });
  });
});
