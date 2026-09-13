import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  LocalStorageProvider,
  localUploadTokens,
} from "../../src/storage/providers/localStorageProvider.js";

describe("LocalStorageProvider", () => {
  let tempDir: string;
  let provider: LocalStorageProvider;
  const baseUrl = "http://localhost:3000";

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "job-tools-storage-test-"));
    provider = new LocalStorageProvider({
      baseDir: tempDir,
      baseUrl,
    });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    localUploadTokens.clear();
  });

  it("should initialize and create baseDir", () => {
    expect(provider.name).toBe("local");
    expect(fs.existsSync(tempDir)).toBe(true);
  });

  it("should successfully upload a file from a local path", async () => {
    const testFilePath = path.join(tempDir, "sample.pdf");
    fs.writeFileSync(testFilePath, "%PDF-1.4 test content");

    const result = await provider.uploadFile({
      filePath: testFilePath,
      fileName: "john_resume.pdf",
      userId: "11111111-1111-1111-1111-111111111111",
      resumeId: "22222222-2222-2222-2222-222222222222",
    });

    expect(result.success).toBe(true);
    expect(result.storageProvider).toBe("local");
    expect(result.fileKey).toContain("users/11111111-1111-1111-1111-111111111111/resumes/22222222-2222-2222-2222-222222222222/");
    expect(result.fileKey).toContain("john_resume.pdf");
    expect(result.downloadUrl).toBe(`${baseUrl}/uploads/${result.fileKey}`);
    expect(result.fileSize).toBeGreaterThan(0);

    // Verify file exists on disk at destination
    const storedPath = path.join(tempDir, result.fileKey);
    expect(fs.existsSync(storedPath)).toBe(true);
  });

  it("should successfully upload a file from buffer", async () => {
    const buffer = Buffer.from("%PDF-1.4 buffer test");

    const result = await provider.uploadFile({
      buffer,
      fileName: "buffer_resume.pdf",
      userId: "11111111-1111-1111-1111-111111111111",
    });

    expect(result.success).toBe(true);
    expect(result.fileSize).toBe(buffer.length);
    const storedPath = path.join(tempDir, result.fileKey);
    expect(fs.existsSync(storedPath)).toBe(true);
  });

  it("should return failure if input file path does not exist", async () => {
    const result = await provider.uploadFile({
      filePath: "/non/existent/path/resume.pdf",
      fileName: "failed.pdf",
      userId: "11111111-1111-1111-1111-111111111111",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Input file not found");
  });

  it("should generate a presigned upload token and URL", async () => {
    const result = await provider.generateUploadUrl({
      userId: "11111111-1111-1111-1111-111111111111",
      resumeId: "22222222-2222-2222-2222-222222222222",
      fileName: "upload_target.pdf",
      expiresInSeconds: 600,
    });

    expect(result.success).toBe(true);
    expect(result.method).toBe("PUT");
    expect(result.uploadUrl).toContain(`${baseUrl}/api/storage/upload?key=`);
    expect(result.uploadUrl).toContain("&token=");
    expect(result.expiresInSeconds).toBe(600);
    expect(localUploadTokens.size).toBe(1);
  });

  it("should get download URL for an existing file", async () => {
    const buffer = Buffer.from("test");
    const upload = await provider.uploadFile({
      buffer,
      fileName: "existing.pdf",
      userId: "11111111-1111-1111-1111-111111111111",
    });

    const download = await provider.getDownloadUrl({ fileKey: upload.fileKey });
    expect(download.success).toBe(true);
    expect(download.downloadUrl).toBe(`${baseUrl}/uploads/${upload.fileKey}`);
  });

  it("should return error if getDownloadUrl called on non-existent file", async () => {
    const download = await provider.getDownloadUrl({ fileKey: "non/existent.pdf" });
    expect(download.success).toBe(false);
    expect(download.error).toContain("File not found");
  });

  it("should delete an existing file", async () => {
    const buffer = Buffer.from("to be deleted");
    const upload = await provider.uploadFile({
      buffer,
      fileName: "delete_me.pdf",
      userId: "11111111-1111-1111-1111-111111111111",
    });

    expect(fs.existsSync(path.join(tempDir, upload.fileKey))).toBe(true);
    const deleted = await provider.deleteFile(upload.fileKey);
    expect(deleted).toBe(true);
    expect(fs.existsSync(path.join(tempDir, upload.fileKey))).toBe(false);
  });
});
