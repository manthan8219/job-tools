import fs from "node:fs";
import path from "node:path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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

export interface S3ProviderConfig {
  bucket: string;
  region?: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
  publicBaseUrl?: string;
}

export class S3StorageProvider implements StorageProvider {
  readonly name = "s3-compatible" as const;
  private client: S3Client;
  private bucket: string;
  private publicBaseUrl?: string;

  constructor(config: S3ProviderConfig) {
    this.bucket = config.bucket;
    this.publicBaseUrl = config.publicBaseUrl?.replace(/\/+$/, "");

    this.client = new S3Client({
      region: config.region || "us-east-1",
      endpoint: config.endpoint || undefined,
      forcePathStyle: config.forcePathStyle || false,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
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
      let body: Buffer;

      if (options.filePath) {
        const resolvedInput = path.resolve(options.filePath);
        if (!fs.existsSync(resolvedInput)) {
          return {
            success: false,
            fileKey: "",
            downloadUrl: "",
            storageProvider: "s3-compatible",
            jobId: options.jobId,
            error: `Input file not found at ${resolvedInput}`,
          };
        }
        body = fs.readFileSync(resolvedInput);
      } else if (options.buffer) {
        body = options.buffer;
      } else {
        return {
          success: false,
          fileKey: "",
          downloadUrl: "",
          storageProvider: "s3-compatible",
          jobId: options.jobId,
          error: "Neither filePath nor buffer was provided for upload.",
        };
      }

      const contentType = options.contentType || "application/pdf";

      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: fileKey,
          Body: body,
          ContentType: contentType,
        })
      );

      let downloadUrl: string;
      if (this.publicBaseUrl) {
        downloadUrl = `${this.publicBaseUrl}/${fileKey}`;
      } else {
        // Generate pre-signed GET URL valid for 24 hours
        downloadUrl = await getSignedUrl(
          this.client,
          new GetObjectCommand({
            Bucket: this.bucket,
            Key: fileKey,
          }),
          { expiresIn: 86400 }
        );
      }

      logger.info(`[S3StorageProvider] Successfully uploaded to s3://${this.bucket}/${fileKey}`);

      return {
        success: true,
        fileKey,
        downloadUrl,
        storageProvider: "s3-compatible",
        fileSize: body.length,
        contentType,
        jobId: options.jobId,
      };
    } catch (error: any) {
      logger.error("[S3StorageProvider] Upload failed", error);
      return {
        success: false,
        fileKey: "",
        downloadUrl: "",
        storageProvider: "s3-compatible",
        jobId: options.jobId,
        error: error.message || "S3 upload failed",
      };
    }
  }

  async generateUploadUrl(options: GenerateUploadUrlOptions): Promise<PresignedUploadResult> {
    try {
      const fileKey = this.buildFileKey(
        options.userId,
        options.resumeId,
        options.jobId,
        options.fileName
      );
      const expiresInSeconds = options.expiresInSeconds || 900;
      const contentType = options.contentType || "application/pdf";

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
        ContentType: contentType,
      });

      const uploadUrl = await getSignedUrl(this.client, command, {
        expiresIn: expiresInSeconds,
      });

      return {
        success: true,
        uploadUrl,
        fileKey,
        method: "PUT",
        headers: {
          "Content-Type": contentType,
        },
        expiresInSeconds,
        storageProvider: "s3-compatible",
        jobId: options.jobId,
      };
    } catch (error: any) {
      logger.error("[S3StorageProvider] Failed to generate presigned upload URL", error);
      return {
        success: false,
        uploadUrl: "",
        fileKey: "",
        method: "PUT",
        expiresInSeconds: 0,
        storageProvider: "s3-compatible",
        jobId: options.jobId,
        error: error.message || "Failed to generate presigned upload URL",
      };
    }
  }

  async getDownloadUrl(options: GetDownloadUrlOptions): Promise<DownloadUrlResult> {
    try {
      const expiresInSeconds = options.expiresInSeconds || 3600;

      if (this.publicBaseUrl) {
        return {
          success: true,
          downloadUrl: `${this.publicBaseUrl}/${options.fileKey}`,
          fileKey: options.fileKey,
          expiresInSeconds,
          storageProvider: "s3-compatible",
        };
      }

      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: options.fileKey,
      });

      const downloadUrl = await getSignedUrl(this.client, command, {
        expiresIn: expiresInSeconds,
      });

      return {
        success: true,
        downloadUrl,
        fileKey: options.fileKey,
        expiresInSeconds,
        storageProvider: "s3-compatible",
      };
    } catch (error: any) {
      logger.error("[S3StorageProvider] Failed to generate download URL", error);
      return {
        success: false,
        downloadUrl: "",
        fileKey: options.fileKey,
        storageProvider: "s3-compatible",
        error: error.message || "Failed to generate download URL",
      };
    }
  }

  async deleteFile(fileKey: string): Promise<boolean> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: fileKey,
        })
      );
      return true;
    } catch (error) {
      logger.error(`[S3StorageProvider] Failed to delete file ${fileKey}`, error);
      return false;
    }
  }
}
