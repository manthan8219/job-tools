export interface UploadFileOptions {
  filePath?: string;
  buffer?: Buffer;
  fileName: string;
  userId: string;
  resumeId?: string;
  contentType?: string;
}

export interface UploadResult {
  success: boolean;
  fileKey: string;
  downloadUrl: string;
  storageProvider: "local" | "s3-compatible";
  fileSize?: number;
  contentType?: string;
  error?: string;
}

export interface GenerateUploadUrlOptions {
  userId: string;
  resumeId?: string;
  fileName: string;
  contentType?: string;
  expiresInSeconds?: number;
}

export interface PresignedUploadResult {
  success: boolean;
  uploadUrl: string;
  fileKey: string;
  method: "PUT" | "POST";
  headers?: Record<string, string>;
  expiresInSeconds: number;
  storageProvider: "local" | "s3-compatible";
  error?: string;
}

export interface GetDownloadUrlOptions {
  fileKey: string;
  expiresInSeconds?: number;
}

export interface DownloadUrlResult {
  success: boolean;
  downloadUrl: string;
  fileKey: string;
  expiresInSeconds?: number;
  storageProvider: "local" | "s3-compatible";
  error?: string;
}

export interface StorageProvider {
  readonly name: "local" | "s3-compatible";
  uploadFile(options: UploadFileOptions): Promise<UploadResult>;
  generateUploadUrl(options: GenerateUploadUrlOptions): Promise<PresignedUploadResult>;
  getDownloadUrl(options: GetDownloadUrlOptions): Promise<DownloadUrlResult>;
  deleteFile(fileKey: string): Promise<boolean>;
}
