import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { storageService } from "../../storage/services/storageService.js";

export const uploadResumeFileTool = createTool({
  id: "uploadResumeFile",
  description:
    "Uploads a locally generated resume file (PDF, DOCX, etc.) directly to blob/file storage (local or S3/R2/MinIO). Automatically links the resulting download URL to the candidate's resume in the database if resumeId is provided.",
  inputSchema: z.object({
    userId: z.string().uuid().describe("Unique identifier of the user who owns this resume"),
    resumeId: z.string().uuid().optional().describe("Optional unique identifier of the resume to link this file with"),
    filePath: z.string().describe("The local filesystem path to the generated resume file (e.g. /tmp/resume.pdf)"),
    fileName: z.string().default("resume.pdf").describe("File name to store (e.g., 'JohnDoe_FullStack_Resume.pdf')"),
    contentType: z.string().default("application/pdf").describe("MIME type of the file, defaults to 'application/pdf'"),
  }),
  execute: async ({ userId, resumeId, filePath, fileName, contentType }) => {
    return await storageService.uploadResumeFile({
      userId,
      resumeId,
      filePath,
      fileName,
      contentType,
    });
  },
});

export const generateResumeUploadUrlTool = createTool({
  id: "generateResumeUploadUrl",
  description:
    "Generates a pre-signed or direct HTTP upload URL for uploading a resume file directly to blob storage (Cloudflare R2, S3, or local server endpoint) without transferring large file streams through chat messages.",
  inputSchema: z.object({
    userId: z.string().uuid().describe("Unique identifier of the user"),
    resumeId: z.string().uuid().optional().describe("Optional unique identifier of the resume"),
    fileName: z.string().default("resume.pdf").describe("Target file name (e.g., 'resume.pdf')"),
    contentType: z.string().default("application/pdf").describe("MIME type expected during upload (default: application/pdf)"),
    expiresInSeconds: z.number().default(900).describe("Expiry time for the upload URL in seconds (default: 900s = 15 minutes)"),
  }),
  execute: async ({ userId, resumeId, fileName, contentType, expiresInSeconds }) => {
    return await storageService.generateResumeUploadUrl({
      userId,
      resumeId,
      fileName,
      contentType,
      expiresInSeconds,
    });
  },
});

export const getResumeDownloadUrlTool = createTool({
  id: "getResumeDownloadUrl",
  description:
    "Generates or retrieves a secure download/view URL for a stored resume file using its fileKey.",
  inputSchema: z.object({
    fileKey: z.string().describe("The storage key/path of the file (e.g., 'users/123/resumes/456/1726207200-resume.pdf')"),
    expiresInSeconds: z.number().default(3600).describe("Expiry duration in seconds for private URLs (default: 3600s = 1 hour)"),
  }),
  execute: async ({ fileKey, expiresInSeconds }) => {
    return await storageService.getResumeDownloadUrl({
      fileKey,
      expiresInSeconds,
    });
  },
});

export const deleteResumeFileTool = createTool({
  id: "deleteResumeFile",
  description:
    "Deletes a stored resume file from blob/local storage using its fileKey.",
  inputSchema: z.object({
    fileKey: z.string().describe("The storage key/path of the file to delete"),
  }),
  execute: async ({ fileKey }) => {
    const success = await storageService.deleteResumeFile(fileKey);
    return { success, fileKey };
  },
});
