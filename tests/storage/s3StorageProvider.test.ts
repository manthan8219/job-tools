import { describe, it, expect, vi, beforeEach } from "vitest";
import { S3StorageProvider } from "../../src/storage/providers/s3StorageProvider.js";

const mockSend = vi.fn();
const mockGetSignedUrl = vi.fn();

vi.mock("@aws-sdk/client-s3", () => {
  return {
    S3Client: vi.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    PutObjectCommand: vi.fn().mockImplementation((input) => ({ input, type: "PutObject" })),
    GetObjectCommand: vi.fn().mockImplementation((input) => ({ input, type: "GetObject" })),
    DeleteObjectCommand: vi.fn().mockImplementation((input) => ({ input, type: "DeleteObject" })),
  };
});

vi.mock("@aws-sdk/s3-request-presigner", () => {
  return {
    getSignedUrl: (...args: any[]) => mockGetSignedUrl(...args),
  };
});

describe("S3StorageProvider", () => {
  let provider: S3StorageProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new S3StorageProvider({
      bucket: "test-bucket",
      region: "us-east-1",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
    });
  });

  it("should initialize with s3-compatible name", () => {
    expect(provider.name).toBe("s3-compatible");
  });

  it("should upload file buffer and return presigned download url", async () => {
    mockSend.mockResolvedValueOnce({});
    mockGetSignedUrl.mockResolvedValueOnce("https://test-bucket.s3.amazonaws.com/presigned-get");

    const result = await provider.uploadFile({
      buffer: Buffer.from("pdf-data"),
      fileName: "resume.pdf",
      userId: "11111111-1111-1111-1111-111111111111",
      resumeId: "22222222-2222-2222-2222-222222222222",
    });

    expect(result.success).toBe(true);
    expect(result.storageProvider).toBe("s3-compatible");
    expect(result.downloadUrl).toBe("https://test-bucket.s3.amazonaws.com/presigned-get");
    expect(result.fileKey).toContain("users/11111111-1111-1111-1111-111111111111/resumes/22222222-2222-2222-2222-222222222222/");
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("should use publicBaseUrl when provided", async () => {
    const cdnProvider = new S3StorageProvider({
      bucket: "test-bucket",
      accessKeyId: "key",
      secretAccessKey: "secret",
      publicBaseUrl: "https://cdn.example.com",
    });

    mockSend.mockResolvedValueOnce({});

    const result = await cdnProvider.uploadFile({
      buffer: Buffer.from("pdf-data"),
      fileName: "resume.pdf",
      userId: "11111111-1111-1111-1111-111111111111",
    });

    expect(result.success).toBe(true);
    expect(result.downloadUrl).toBe(`https://cdn.example.com/${result.fileKey}`);
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });

  it("should generate presigned upload PUT URL", async () => {
    mockGetSignedUrl.mockResolvedValueOnce("https://test-bucket.s3.amazonaws.com/presigned-put");

    const result = await provider.generateUploadUrl({
      userId: "11111111-1111-1111-1111-111111111111",
      fileName: "uploaded.pdf",
      expiresInSeconds: 900,
    });

    expect(result.success).toBe(true);
    expect(result.method).toBe("PUT");
    expect(result.uploadUrl).toBe("https://test-bucket.s3.amazonaws.com/presigned-put");
    expect(result.headers).toEqual({ "Content-Type": "application/pdf" });
  });

  it("should get download URL for existing file key", async () => {
    mockGetSignedUrl.mockResolvedValueOnce("https://test-bucket.s3.amazonaws.com/get-url");

    const result = await provider.getDownloadUrl({
      fileKey: "users/123/resumes/resume.pdf",
      expiresInSeconds: 1800,
    });

    expect(result.success).toBe(true);
    expect(result.downloadUrl).toBe("https://test-bucket.s3.amazonaws.com/get-url");
  });

  it("should delete a file in S3", async () => {
    mockSend.mockResolvedValueOnce({});

    const deleted = await provider.deleteFile("users/123/resumes/resume.pdf");
    expect(deleted).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("should handle S3 upload errors gracefully without throwing", async () => {
    mockSend.mockRejectedValueOnce(new Error("S3 Access Denied"));

    const result = await provider.uploadFile({
      buffer: Buffer.from("data"),
      fileName: "fail.pdf",
      userId: "11111111-1111-1111-1111-111111111111",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("S3 Access Denied");
  });
});
