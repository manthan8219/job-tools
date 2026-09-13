import type {
  StorageProvider,
  UploadFileOptions,
  UploadResult,
  GenerateUploadUrlOptions,
  PresignedUploadResult,
  GetDownloadUrlOptions,
  DownloadUrlResult,
} from "../interfaces/storageProvider.js";
import { LocalStorageProvider } from "../providers/localStorageProvider.js";
import { S3StorageProvider } from "../providers/s3StorageProvider.js";
import { config } from "../../config.js";
import { logger } from "../../utils/index.js";
import { resumeService } from "../../resume/services/resumeService.js";

export class StorageService {
  private provider: StorageProvider;

  constructor(provider?: StorageProvider) {
    if (provider) {
      this.provider = provider;
      return;
    }

    // Default provider determination
    const storageConfig = config.storage;
    if (
      storageConfig.provider === "s3-compatible" &&
      storageConfig.s3.bucket &&
      storageConfig.s3.accessKeyId
    ) {
      logger.info("[StorageService] Initialized with S3CompatibleStorageProvider");
      this.provider = new S3StorageProvider({
        bucket: storageConfig.s3.bucket,
        region: storageConfig.s3.region,
        endpoint: storageConfig.s3.endpoint,
        accessKeyId: storageConfig.s3.accessKeyId,
        secretAccessKey: storageConfig.s3.secretAccessKey,
        publicBaseUrl: storageConfig.s3.publicBaseUrl,
        forcePathStyle: storageConfig.s3.forcePathStyle,
      });
    } else {
      logger.info("[StorageService] Initialized with LocalStorageProvider (default fallback)");
      this.provider = new LocalStorageProvider({
        baseDir: storageConfig.localDir,
        baseUrl: storageConfig.publicAppUrl,
      });
    }
  }

  setProvider(provider: StorageProvider): void {
    this.provider = provider;
    logger.info(`[StorageService] Active storage provider switched to: ${provider.name}`);
  }

  getProviderName(): "local" | "s3-compatible" {
    return this.provider.name;
  }

  getProvider(): StorageProvider {
    return this.provider;
  }

  async uploadResumeFile(options: UploadFileOptions): Promise<UploadResult> {
    const result = await this.provider.uploadFile(options);

    // If upload was successful and resumeId is provided, attach the URL to the resume record
    if (result.success && options.resumeId) {
      try {
        await resumeService.updateResumePdfUrl(
          options.resumeId,
          options.userId,
          result.downloadUrl,
          result.fileKey,
          options.jobId
        );
        logger.info(
          `[StorageService] Successfully updated resume ${options.resumeId} with PDF URL: ${result.downloadUrl}${
            options.jobId ? ` (linked to job ${options.jobId})` : ""
          }`
        );
      } catch (err: any) {
        logger.warn(
          `[StorageService] Upload succeeded but failed to update resume record for ${options.resumeId}: ${err.message}`
        );
      }
    }

    return result;
  }

  async generateResumeUploadUrl(
    options: GenerateUploadUrlOptions
  ): Promise<PresignedUploadResult> {
    return await this.provider.generateUploadUrl(options);
  }

  async getResumeDownloadUrl(
    options: GetDownloadUrlOptions
  ): Promise<DownloadUrlResult> {
    return await this.provider.getDownloadUrl(options);
  }

  async deleteResumeFile(fileKey: string): Promise<boolean> {
    return await this.provider.deleteFile(fileKey);
  }
}

export const storageService = new StorageService();
