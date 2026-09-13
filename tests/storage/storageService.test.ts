import { describe, it, expect, vi, beforeEach } from "vitest";
import { StorageService } from "../../src/storage/services/storageService.js";
import type { StorageProvider } from "../../src/storage/interfaces/storageProvider.js";
import { resumeService } from "../../src/resume/services/resumeService.js";

vi.mock("../../src/resume/services/resumeService.js", () => ({
  resumeService: {
    updateResumePdfUrl: vi.fn(),
  },
}));

describe("StorageService", () => {
  let service: StorageService;
  let mockProvider: StorageProvider;

  beforeEach(() => {
    vi.clearAllMocks();

    mockProvider = {
      name: "local",
      uploadFile: vi.fn().mockResolvedValue({
        success: true,
        fileKey: "users/u1/resumes/r1/test.pdf",
        downloadUrl: "http://localhost:3000/uploads/users/u1/resumes/r1/test.pdf",
        storageProvider: "local",
        fileSize: 1024,
      }),
      generateUploadUrl: vi.fn().mockResolvedValue({
        success: true,
        uploadUrl: "http://localhost:3000/api/storage/upload?key=users/u1/test.pdf&token=xyz",
        fileKey: "users/u1/test.pdf",
        method: "PUT",
        expiresInSeconds: 900,
        storageProvider: "local",
      }),
      getDownloadUrl: vi.fn().mockResolvedValue({
        success: true,
        downloadUrl: "http://localhost:3000/uploads/users/u1/test.pdf",
        fileKey: "users/u1/test.pdf",
        storageProvider: "local",
      }),
      deleteFile: vi.fn().mockResolvedValue(true),
    };

    service = new StorageService(mockProvider);
  });

  it("should return the active provider name", () => {
    expect(service.getProviderName()).toBe("local");
  });

  it("should delegate uploadResumeFile and update resume if resumeId is provided", async () => {
    vi.mocked(resumeService.updateResumePdfUrl).mockResolvedValueOnce({} as any);

    const result = await service.uploadResumeFile({
      fileName: "test.pdf",
      userId: "u1",
      resumeId: "r1",
      jobId: "j1",
    });

    expect(result.success).toBe(true);
    expect(mockProvider.uploadFile).toHaveBeenCalledTimes(1);
    expect(resumeService.updateResumePdfUrl).toHaveBeenCalledWith(
      "r1",
      "u1",
      result.downloadUrl,
      result.fileKey,
      "j1"
    );
  });

  it("should not fail upload if resumeService throws", async () => {
    vi.mocked(resumeService.updateResumePdfUrl).mockRejectedValueOnce(
      new Error("Resume not found")
    );

    const result = await service.uploadResumeFile({
      fileName: "test.pdf",
      userId: "u1",
      resumeId: "r1",
    });

    expect(result.success).toBe(true);
    expect(mockProvider.uploadFile).toHaveBeenCalledTimes(1);
  });

  it("should delegate generateResumeUploadUrl to provider", async () => {
    const result = await service.generateResumeUploadUrl({
      userId: "u1",
      fileName: "upload.pdf",
    });

    expect(result.success).toBe(true);
    expect(result.method).toBe("PUT");
    expect(mockProvider.generateUploadUrl).toHaveBeenCalledTimes(1);
  });

  it("should delegate getResumeDownloadUrl to provider", async () => {
    const result = await service.getResumeDownloadUrl({
      fileKey: "users/u1/test.pdf",
    });

    expect(result.success).toBe(true);
    expect(result.downloadUrl).toContain("test.pdf");
    expect(mockProvider.getDownloadUrl).toHaveBeenCalledTimes(1);
  });

  it("should delegate deleteResumeFile to provider", async () => {
    const success = await service.deleteResumeFile("users/u1/test.pdf");
    expect(success).toBe(true);
    expect(mockProvider.deleteFile).toHaveBeenCalledWith("users/u1/test.pdf");
  });

  it("should support switching provider dynamically", () => {
    const s3Mock: StorageProvider = {
      ...mockProvider,
      name: "s3-compatible",
    };

    service.setProvider(s3Mock);
    expect(service.getProviderName()).toBe("s3-compatible");
  });
});
