import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  uploadResumeFileTool,
  generateResumeUploadUrlTool,
  getResumeDownloadUrlTool,
  deleteResumeFileTool,
} from "../../../src/tools/storage/storageTools.js";
import { storageService } from "../../../src/storage/services/storageService.js";

describe("Storage MCP Tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("uploadResumeFileTool", () => {
    it("should execute uploadResumeFileTool successfully", async () => {
      vi.spyOn(storageService, "uploadResumeFile").mockResolvedValueOnce({
        success: true,
        fileKey: "users/11111111-1111-1111-1111-111111111111/resumes/resume.pdf",
        downloadUrl: "http://localhost:3000/uploads/users/11111111-1111-1111-1111-111111111111/resumes/resume.pdf",
        storageProvider: "local",
        fileSize: 2048,
        contentType: "application/pdf",
      });

      const result = await uploadResumeFileTool.execute({
        userId: "11111111-1111-1111-1111-111111111111",
        filePath: "/tmp/resume.pdf",
        fileName: "resume.pdf",
        contentType: "application/pdf",
      });

      expect(result.success).toBe(true);
      expect(result.downloadUrl).toContain("resume.pdf");
      expect(storageService.uploadResumeFile).toHaveBeenCalledWith({
        userId: "11111111-1111-1111-1111-111111111111",
        resumeId: undefined,
        filePath: "/tmp/resume.pdf",
        fileName: "resume.pdf",
        contentType: "application/pdf",
      });
    });
  });

  describe("generateResumeUploadUrlTool", () => {
    it("should execute generateResumeUploadUrlTool successfully", async () => {
      vi.spyOn(storageService, "generateResumeUploadUrl").mockResolvedValueOnce({
        success: true,
        uploadUrl: "http://localhost:3000/api/storage/upload?key=users/11111111-1111-1111-1111-111111111111/test.pdf&token=abc",
        fileKey: "users/11111111-1111-1111-1111-111111111111/test.pdf",
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        expiresInSeconds: 900,
        storageProvider: "local",
      });

      const result = await generateResumeUploadUrlTool.execute({
        userId: "11111111-1111-1111-1111-111111111111",
        fileName: "test.pdf",
        contentType: "application/pdf",
        expiresInSeconds: 900,
      });

      expect(result.success).toBe(true);
      expect(result.uploadUrl).toContain("api/storage/upload");
      expect(result.method).toBe("PUT");
    });
  });

  describe("getResumeDownloadUrlTool", () => {
    it("should execute getResumeDownloadUrlTool successfully", async () => {
      vi.spyOn(storageService, "getResumeDownloadUrl").mockResolvedValueOnce({
        success: true,
        downloadUrl: "http://localhost:3000/uploads/users/123/resume.pdf",
        fileKey: "users/123/resume.pdf",
        storageProvider: "local",
      });

      const result = await getResumeDownloadUrlTool.execute({
        fileKey: "users/123/resume.pdf",
        expiresInSeconds: 3600,
      });

      expect(result.success).toBe(true);
      expect(result.downloadUrl).toBe("http://localhost:3000/uploads/users/123/resume.pdf");
    });
  });

  describe("deleteResumeFileTool", () => {
    it("should execute deleteResumeFileTool successfully", async () => {
      vi.spyOn(storageService, "deleteResumeFile").mockResolvedValueOnce(true);

      const result = await deleteResumeFileTool.execute({
        fileKey: "users/123/resume.pdf",
      });

      expect(result.success).toBe(true);
      expect(result.fileKey).toBe("users/123/resume.pdf");
    });
  });
});
