import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type {
  StorageProvider,
  UploadFileOptions,
  UploadResult,
  GenerateUploadUrlOptions,
  PresignedUploadResult,
  GetDownloadUrlOptions,
  DownloadUrlResult,
} from "../interfaces/storageProvider.js";
import { logger } from "../../utils/index.js";

// In-memory upload token store for local presigned uploads
interface LocalUploadTokenData {
  fileKey: string;
  expiresAt: number;
}

export const localUploadTokens = new Map<string, LocalUploadTokenData>();

export class LocalStorageProvider implements StorageProvider {
  readonly name = "local" as const;
  private baseDir: string;
  private baseUrl: string;

  constructor(options?: { baseDir?: string; baseUrl?: string }) {
    this.baseDir = path.resolve(options?.baseDir || process.env.STORAGE_LOCAL_DIR || "./uploads");
    this.baseUrl = (options?.baseUrl || process.env.PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, "");

    // Ensure upload directory exists
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  getBaseDir(): string {
    return this.baseDir;
  }

  private sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  }

  private buildFileKey(
    userId: string,
    resumeId: string | undefined,
    jobId: string | undefined,
    fileName: string
  ): string {
    const safeName = this.sanitizeFileName(fileName);
    const timestamp = Date.now();
    const jobPart = jobId ? `jobs/${jobId}/` : "";
    const resumePart = resumeId ? `${resumeId}/` : "";
    return `users/${userId}/${jobPart}resumes/${resumePart}${timestamp}-${safeName}`;
  }

  async uploadFile(options: UploadFileOptions): Promise<UploadResult> {
    try {
      const fileKey = this.buildFileKey(
        options.userId,
        options.resumeId,
        options.jobId,
        options.fileName
      );
      const destinationPath = path.join(this.baseDir, fileKey);

      // Ensure directory exists
      fs.mkdirSync(path.dirname(destinationPath), { recursive: true });

      if (options.filePath) {
        const resolvedInput = path.resolve(options.filePath);
        if (!fs.existsSync(resolvedInput)) {
          return {
            success: false,
            fileKey: "",
            downloadUrl: "",
            storageProvider: "local",
            jobId: options.jobId,
            error: `Input file not found at ${resolvedInput}`,
          };
        }
        fs.copyFileSync(resolvedInput, destinationPath);
      } else if (options.buffer) {
        fs.writeFileSync(destinationPath, options.buffer);
      } else {
        return {
          success: false,
          fileKey: "",
          downloadUrl: "",
          storageProvider: "local",
          jobId: options.jobId,
          error: "Neither filePath nor buffer was provided for upload.",
        };
      }

      const stat = fs.statSync(destinationPath);
      const downloadUrl = `${this.baseUrl}/uploads/${fileKey}`;

      logger.info(`[LocalStorageProvider] Successfully stored file at ${destinationPath} -> ${downloadUrl}`);

      return {
        success: true,
        fileKey,
        downloadUrl,
        storageProvider: "local",
        fileSize: stat.size,
        contentType: options.contentType || "application/pdf",
        jobId: options.jobId,
      };
    } catch (error: any) {
      logger.error("[LocalStorageProvider] Upload failed", error);
      return {
        success: false,
        fileKey: "",
        downloadUrl: "",
        storageProvider: "local",
        jobId: options.jobId,
        error: error.message || "Local upload failed",
      };
    }
  }

  async generateUploadUrl(options: GenerateUploadUrlOptions): Promise<PresignedUploadResult> {
    const fileKey = this.buildFileKey(
      options.userId,
      options.resumeId,
      options.jobId,
      options.fileName
    );
    const token = crypto.randomBytes(24).toString("hex");
    const expiresInSeconds = options.expiresInSeconds || 900; // 15 mins default
    const expiresAt = Date.now() + expiresInSeconds * 1000;

    localUploadTokens.set(token, { fileKey, expiresAt });

    const uploadUrl = `${this.baseUrl}/api/storage/upload?key=${encodeURIComponent(fileKey)}&token=${token}`;

    return {
      success: true,
      uploadUrl,
      fileKey,
      method: "PUT",
      headers: {
        "Content-Type": options.contentType || "application/pdf",
      },
      expiresInSeconds,
      storageProvider: "local",
      jobId: options.jobId,
    };
  }

  async getDownloadUrl(options: GetDownloadUrlOptions): Promise<DownloadUrlResult> {
    const targetPath = path.join(this.baseDir, options.fileKey);
    if (!fs.existsSync(targetPath)) {
      return {
        success: false,
        downloadUrl: "",
        fileKey: options.fileKey,
        storageProvider: "local",
        error: `File not found at key ${options.fileKey}`,
      };
    }

    return {
      success: true,
      downloadUrl: `${this.baseUrl}/uploads/${options.fileKey}`,
      fileKey: options.fileKey,
      expiresInSeconds: options.expiresInSeconds,
      storageProvider: "local",
    };
  }

  async deleteFile(fileKey: string): Promise<boolean> {
    try {
      const targetPath = path.join(this.baseDir, fileKey);
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`[LocalStorageProvider] Failed to delete file ${fileKey}`, error);
      return false;
    }
  }
}
